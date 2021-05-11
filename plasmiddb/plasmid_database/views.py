import io
import os
import json
import zipfile
import time
from datetime import datetime
from pprint import pprint
from itertools import chain
import pandas as pd
import csv
import sys
import pdb

import click
import requests

from django.apps import apps
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, Http404
from django.utils.html import escape
from django_datatables_view.base_datatable_view import BaseDatatableView

import boto3
from django_comments.models import Comment

import dnassembly as dna
from dnassembly.utils.annotation import annotate_moclo
from dnassembly.utils.benchlingAPI import *
from dnassembly.reactions.PartDesigner.partDesigner import GGpart
from dnassembly.reactions.moclo import MoCloPartFromSequence

from .models import Plasmid, User, Project, Feature, Attribute, FeatureType, PlasmidAssembly, PlasmidAlias, PlasmidFile
from .forms import SignUpForm, PlasmidFileForm

Locations = apps.get_model('locations', 'Location')

# todo: separate views into separate files based on page/function

# --- New User Enrollment --- #

def new_user(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            form.save()
            username = form.cleaned_data.get('username')
            raw_password = form.cleaned_data.get('password1')
            initials = form.cleaned_data.get('initials')
            first_name = form.cleaned_data.get('first_name')
            last_name = form.cleaned_data.get('last_name')
            user_project = Project(project=username,
                                   initials=initials,
                                   description=f'Default project for {first_name} {last_name}.',
                                   )
            user_project.save()
            user = authenticate(username=username, password=raw_password)
            login(request, user)
            return redirect('plasmid_database:database')
    else:
        form = SignUpForm()
    return render(request, 'registration/signup.html', {'form': form})

# --- Template Datatable View --- #

class FilterDatatableTemplate(BaseDatatableView):

    def filter_queryset(self, qs):

        column_index_mapping = {column: self.request.GET.get(f'columns[{index}][search][value]', None)
                                for index, column in enumerate(self.columns)}

        # Return unaltered qs if there is no user input
        if all([value in [None, ''] for value in column_index_mapping.values()]):
            return qs

        # Search
        else:
            column_querysets = list()
            for current_field, search_term in column_index_mapping.items():

                if search_term not in [None, '']:
                    if current_field in ['creator', 'project']:
                        term_filter = {f'{current_field}__id__iexact': search_term}
                        column_querysets.append(qs.filter(**term_filter))

                    elif current_field == 'projectindex':
                        term_filter = {f'{current_field}__exact': int(search_term)}
                        column_querysets.append(qs.filter(**term_filter))

                    else:
                        # Check if input is valid regex
                        try:
                            re.compile(search_term)
                            is_valid = True
                        except re.error:
                            is_valid = False

                        search_method = 'iregex' if is_valid else 'icontains'

                        if current_field == 'attribute':
                            # Special case for assembly... Need to take all attributes for a single plasmid into account
                            # _AssemblyRegex`Part 1|Part 2`Part 3|Part 4
                            if search_term.startswith('_AssemblyRegex'):
                                term_split = search_term.split('`')

                                term_filter_positive = {f'attribute__name__iregex': f'^.*({term_split[2]}).*$'}
                                positive_qs = qs.filter(**term_filter_positive)

                                if term_split[1] == '':
                                    column_querysets.append(positive_qs)

                                else:
                                    term_filter_negative = {f'attribute__name__iregex': f'^.*({term_split[1]}).*$'}
                                    negative_qs = qs.filter(**term_filter_negative)
                                    attribute_difference_qs = positive_qs.difference(negative_qs)
                                    column_querysets.append(attribute_difference_qs)

                            else:
                                term_filter = {f'{current_field}__name__{search_method}': search_term}
                                column_querysets.append(qs.filter(**term_filter))

                        elif current_field in ['feature', 'location']:
                            term_filter = {f'{current_field}__name__{search_method}': search_term}
                            column_querysets.append(qs.filter(**term_filter))

                        elif current_field == 'alias':
                            term_filter = {f'aliases__alias__{search_method}': search_term}
                            column_querysets.append(qs.filter(**term_filter))

                        elif current_field == 'assembly':
                            # Convert user input to Plasmid IDs
                            for assembly_plasmid in search_term.split(','):
                                standard_match = re.match(r"([a-zA-Z]+)([0-9]+)", assembly_plasmid.strip(), re.I)
                                if standard_match:
                                    project, project_id = standard_match.groups()
                                    try:
                                        plasmid = Plasmid.objects.get(project__project__iexact=project, projectindex=int(project_id))
                                        term_filter = {f'plasmidproduct__input__id__exact': plasmid.id}
                                        column_querysets.append(qs.filter(**term_filter))
                                    except Exception as e:
                                        print(e)
                        # todo: enable resistance search
                        else:
                            term_filter = {f'{current_field}__{search_method}': search_term}
                            column_querysets.append(qs.filter(**term_filter))

            if len(column_querysets) == 0:
                return qs
            elif len(column_querysets) == 1:
                return column_querysets[0].distinct()
            else:
                print(column_querysets)
                return column_querysets[0].intersection(*column_querysets[1:]).distinct()

# --- Plasmid Datatables --- #

class PlasmidDatatable(FilterDatatableTemplate):

    model = Plasmid
    columns = ['id', 'project', 'projectindex', 'alias', 'description', 'attribute', 'resistance', 'feature', 'location', 'status', 'assembly',  'creator', 'created']
    order_columns = ['id', 'project', 'projectindex', 'alias', 'description', 'attribute', 'resistance', 'feature', 'location', 'status', 'assembly',  'creator', 'created']
    max_display_length = 500

    def render_column(self, row, column):
        return super(PlasmidDatatable, self).render_column(row, column)

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(int(item.id)),  # id
                escape(str(item.project.project)),  # project
                escape(item.projectindex),  # projectindex
                item.get_aliases_as_string(),  # alias
                item.description,  # description
                item.get_attributes_as_string(),  # attribute
                item.get_resistance_as_string(),  # resistance
                item.get_features_as_string(),  # feature
                item.get_locations_as_string(),  # location
                item.status,  # status
                item.get_assembly_plasmids_as_string(),  # assembly
                str(item.creator),  # creator
                item.created.strftime('%Y-%m-%d %H:%M:%S')  # created
            ])
        return json_data


@login_required
def download_selected_plasmids(request):
    plasmid_indicies_str = json.loads(request.POST['DownloadSelectedDatabasePlasmids'])
    plasmid_indicies = [int(index) for index in plasmid_indicies_str]
    plasmid_records = Plasmid.objects.filter(id__in=plasmid_indicies)
    zip_subdir = 'Plasmids'
    zip_filename = 'Plasmids.zip'

    response = HttpResponse(content_type='application/zip')
    zip_file = zipfile.ZipFile(response, 'w')

    for plasmid in plasmid_records:
        # Write plasmid genbank to StringIO
        plasmid_name = f'{plasmid.get_standard_id()}.gb'
        plasmid_genbank = plasmid.as_dnassembly()
        plasmid_io = io.StringIO()
        dnassembly.io.write_genbank(plasmid_genbank, output=plasmid_io, to_stream=True)
        plasmid_io.seek(0)
        # Add to ZIP
        zip_path = os.path.join(zip_subdir, plasmid_name)
        zip_file.writestr(zip_path, plasmid_io.read())

    zip_file.close()
    response['Content-Disposition'] = f'attachment;filename={zip_filename}'
    response['Content-Type'] = 'application/zip'
    return response


@login_required
def get_assembly_instructions(request):
    plasmid_indicies_str = json.loads(request.POST['PlasmidAssemblyInstructions'])
    plasmid_indicies = [int(index) for index in plasmid_indicies_str]
    plasmid_records = Plasmid.objects.filter(id__in=plasmid_indicies)

    part_object = Attribute.objects.get(name='Part')
    part_children_qs = Attribute.objects.filter(subcategory=part_object.id)

    cassette_object = Attribute.objects.get(name='Cassette')
    cassette_children_qs = Attribute.objects.filter(subcategory=cassette_object.id)

    # Separate into Part plasmids and others
    cassette_list = []
    part_list = []

    for plasmid in plasmid_records:
        if any([attr in part_children_qs for attr in plasmid.attribute.all()]):
            if any([attr in cassette_children_qs for attr in plasmid.attribute.all()]):
                cassette_list.append(plasmid)
            else:
                part_list.append(plasmid)
        else:
            cassette_list.append(plasmid)

    # Get part inserts and primers
    part_dict_list = []
    for plasmid in part_list:
        part_dict = {'plasmid': plasmid}
        part_match = re.search('(?:GAAGAC)(.*)(?:GTCTTC)', plasmid.sequence)
        if part_match is not None:
            match_sequence = part_match.group(0)
            moclo_parts = annotate_moclo(plasmid.sequence)
            leftPartType = moclo_parts[0].split()[-1]
            rightPartType = moclo_parts[-1].split()[-1]
            user_defined_part, primers = MoCloPartFromSequence(match_sequence[11:-11], leftPartType, rightPartType,
                                                               standardize=False, create_instructions=True)
            part_dict['insert'] = user_defined_part.sequence
            part_dict['primer_F'] = primers[0]
            part_dict['primer_R'] = primers[1]
        part_dict_list.append(part_dict)

    # Get unique plasmids for cassette assembly
    all_cassette_assembly_plasmids = []
    for plasmid in cassette_list:
        assembly_plasmids = [a.input.id for a in plasmid.plasmidproduct.all()]
        all_cassette_assembly_plasmids += assembly_plasmids

    unique_plasmid_ids = set(all_cassette_assembly_plasmids)
    unique_plasmids = Plasmid.objects.filter(id__in=unique_plasmid_ids)

    context = {'part_list': part_dict_list, 'cassette_list': cassette_list, 'unique_plasmids': unique_plasmids}
    return render(request, 'plasmid_database/clone/clone-assemblyinstructions.html', context)

@login_required
def download_assembly_instructions(request):
    plasmid_indicies_str = json.loads(request.POST['DownloadAssemblyInstructions'])
    plasmid_indicies = [int(index) for index in plasmid_indicies_str]
    plasmid_records = Plasmid.objects.filter(id__in=plasmid_indicies)

    zip_subdir = 'AssemblyInstructions'
    zip_filename = 'AssemblyInstructions.zip'

    response = HttpResponse(content_type='application/zip')
    zip_file = zipfile.ZipFile(response, 'w')

    part_object = Attribute.objects.get(name='Part')
    part_children_qs = Attribute.objects.filter(subcategory=part_object.id)

    cassette_object = Attribute.objects.get(name='Cassette')
    cassette_children_qs = Attribute.objects.filter(subcategory=cassette_object.id)

    # Separate into Part plasmids and others
    cassette_list = []
    part_list = []

    for plasmid in plasmid_records:
        if any([attr in part_children_qs for attr in plasmid.attribute.all()]):
            if any([attr in cassette_children_qs for attr in plasmid.attribute.all()]):
                cassette_list.append(plasmid)
            else:
                part_list.append(plasmid)
        else:
            cassette_list.append(plasmid)

    # Get part inserts and primers
    part_dict_list = []
    for plasmid in part_list:
        part_dict = {'plasmid': plasmid}
        part_match = re.search('(?:GAAGAC)(.*)(?:GTCTTC)', plasmid.sequence)
        if part_match is not None:
            match_sequence = part_match.group(0)
            moclo_parts = annotate_moclo(plasmid.sequence)
            leftPartType = moclo_parts[0].split()[-1]
            rightPartType = moclo_parts[-1].split()[-1]
            user_defined_part, primers = MoCloPartFromSequence(match_sequence[11:-11], leftPartType, rightPartType,
                                                               standardize=False, create_instructions=True)
            part_dict['insert'] = user_defined_part.sequence
            part_dict['primer_F'] = primers[0]
            part_dict['primer_R'] = primers[1]
        part_dict_list.append(part_dict)

    # Get unique plasmids for cassette assembly
    all_cassette_assembly_plasmids = []
    for plasmid in cassette_list:
        assembly_plasmids = [a.input.id for a in plasmid.plasmidproduct.all()]
        all_cassette_assembly_plasmids += assembly_plasmids

    unique_plasmid_ids = set(all_cassette_assembly_plasmids)
    unique_plasmids = Plasmid.objects.filter(id__in=unique_plasmid_ids)

    #import pdb; pdb.set_trace()

    #context = {'part_list': part_dict_list, 'cassette_list': cassette_list, 'unique_plasmids': unique_plasmids}
    #return render(request, 'plasmid_database/clone/clone-assemblyinstructions.html', context)

    # fill this in to zip up the context then download

    #Create a DataFrame containing unique_plasmids
    AssemblyParts = pd.DataFrame(columns = ['Part','Location','Description'])

    for plasmid in unique_plasmids:
        unique_plasmid_info = pd.Series(index = ['Part','Location','Description'])
        unique_plasmid_info['Part'] = (plasmid.get_aliases_as_string())
        unique_plasmid_info['Location'] = (plasmid.get_locations_as_string())
        unique_plasmid_info['Description'] = (plasmid.description)
        AssemblyParts = AssemblyParts.append(unique_plasmid_info, ignore_index = True)
        #TO-DO: look into how locations are stored

    #Create a DataFrame containing the assembly plasmids and their components
    Components = pd.DataFrame(columns = ['Assembly','Components','Resistance'])

    for plasmid in cassette_list:
        cassette_info = pd.Series(index = ['Assembly','Components','Resistance'])
        cassette_info['Assembly'] = (plasmid.get_aliases_as_string())
        cassette_info['Components'] = (plasmid.get_assembly_plasmids_as_string())
        Components = Components.append(cassette_info, ignore_index = True)

    '''
    for plasmid in plasmid_records:
        # Write plasmid genbank to StringIO
        plasmid_name = f'{plasmid.get_standard_id()}.gb'
        plasmid_genbank = plasmid.as_dnassembly()
        plasmid_io = io.StringIO()
        dnassembly.io.write_genbank(plasmid_genbank, output=plasmid_io, to_stream=True)
        plasmid_io.seek(0)
        '''

    # Add to ZIP

    #zip_path = os.path.join(zip_subdir, 'AssemblyParts.csv')
    AssemblyParts.to_csv('AssemblyParts.csv')
    zip_file.write('AssemblyParts.csv')
    #import pdb; pdb.set_trace()
    #zip_path = os.path.join(zip_subdir, 'Components.csv')
    Components.to_csv('Components.csv')
    zip_file.write('Components.csv')

    zip_file.close()
    response['Content-Disposition'] = f'attachment;filename={zip_filename}'
    response['Content-Type'] = 'application/zip'
    return response

@login_required
def update_status(request):
    """Update plasmid status from datatable dropdown"""
    user_id = request.user.id
    plasmid_id = int(request.POST['plasmid_id'])
    status_update = request.POST['statusUpdate']
    requested_plasmid = Plasmid.objects.get(id=plasmid_id)

    if requested_plasmid.creator.id != user_id:
        print('FAIL')
        return JsonResponse({'success': False}, status=200)
    else:
        if status_update not in ['', 'Abandoned', 'Verified', 'Designed']:
            print('FAIL')
            return JsonResponse({'success': False}, status=200)
        requested_plasmid.status = status_update
        requested_plasmid.save()
        return JsonResponse({'success': True}, status=200)


@login_required
def database(request):
    context = {
        'users': User.objects.all(),
        'projects': Project.objects.all(),
    }
    return render(request, 'plasmid_database/database.html', context)

# --- Delete Plasmid and Related Views --- #

@login_required
def delete_user_plasmids(request):
    if request.user.is_authenticated:
        username = request.user.username
        plasmids_to_delete = [int(a) for a in request.POST.getlist('deletedPKs[]')]
        print(plasmids_to_delete)
        plasmid_qs = Plasmid.objects.filter(id__in=plasmids_to_delete, creator__username=username)
        print(plasmid_qs)
        print(plasmid_qs)
        if plasmid_qs.count() == 0:
            return JsonResponse({'success': False}, status=200)
        if plasmid_qs.count() == len(plasmids_to_delete):
            print('Attempting to delete...')
            plasmid_qs.delete()
        return JsonResponse({'success': True}, status=200)
    else:
        return JsonResponse({'success': False}, status=200)


# --- Add Plasmid and Related Views --- #

import io
import re
import dnassembly
from dnassembly.io import read_genbank, ReadAs
from dnassembly.reactions import StickyEndAssembly, AssemblyException, ReactionDefinitionException
from dnassembly.dna import SequenceException
from Bio.Restriction import BbsI, BsmBI


@login_required
def add_plasmids(request):
    context = dict()
    context['users'] = User.objects.all()
    context['projects'] = Project.objects.all()
    context['attribute_roots'] = Attribute.objects.filter(subcategory__isnull=True)
    context['roots_with_children'] = [attr.id for attr in context['attribute_roots'] if Attribute.objects.filter(subcategory=attr)]
    context['partEntryVectors'] = Plasmid.objects.filter(attribute__name='Part Entry Vector')
    return render(request, 'plasmid_database/clone/clone.html', context)


class PlasmidFilterDatatable(FilterDatatableTemplate):

    model = Plasmid
    columns = ['id', 'project', 'projectindex', 'alias', 'description', 'feature', 'attribute']
    order_columns = ['id', 'project', 'projectindex', 'alias', 'description', 'feature', 'attribute']
    max_display_length = 10

    def render_column(self, row, column):
        return super(PlasmidFilterDatatable, self).render_column(row, column)

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(int(item.id)),
                escape(str(item.project.project).capitalize()),
                escape(int(item.projectindex)),
                item.get_aliases_as_string(),
                item.description,
                item.get_features_as_string(),
                item.get_attributes_as_string(),
            ])
        return json_data


def circularly_permute_plasmid(cp_plasmid):
    """Generate circular permutation of plasmid so that it starts with BsmBI/BbsI site"""
    # Circularly permute plasmid so sequence always starts with BbsI/BsmBI site if they exist
    type2_match = re.search('GAAGAC|CGTCTC|GAGACG|GTCTTC', cp_plasmid.sequence.upper())
    if type2_match:
        cp_first_occurrence = cp_plasmid.sequence[type2_match.start():] + cp_plasmid.sequence[:type2_match.start()]
        type2_forward = re.search('GAAGAC|CGTCTC', cp_first_occurrence)
        if type2_forward:
            cp_type2_start = cp_first_occurrence[type2_forward.start():] + cp_first_occurrence[:type2_forward.start()]
            cp_plasmid.sequence = cp_type2_start
    return cp_plasmid


@login_required
def add_plasmid_by_file(request):
    """
    Add a file to the database from a genbank file
    """
    response_dict = {'success': False}

    if request.method == 'POST' and request.FILES['file']:

        # Pull data
        uploaded_file = request.FILES['file']
        plasmid_project = request.POST['project']
        plasmid_attributes = request.POST['attributes']

        response_dict['filename'] = str(uploaded_file.name)

        # Convert BytesIO into something BioPython can work with
        upload_stringio = io.StringIO(uploaded_file.file.getvalue().decode('UTF-8'))
        dnassembly_plasmid = read_genbank(upload_stringio, ReadAs.Plasmid)

        try:
            # Circularly permute plasmid so sequence always starts with BbsI/BsmBI site if they exist
            dnassembly_plasmid = circularly_permute_plasmid(dnassembly_plasmid)

            plasmid_filename, _ = os.path.splitext(response_dict['filename'])

            if dnassembly_plasmid.description == "":
                dnassembly_plasmid.description = plasmid_filename

            # Add plasmid to database
            new_plasmid = Plasmid(sequence=dnassembly_plasmid.sequence,
                                  creator=request.user,
                                  description=dnassembly_plasmid.description,
                                  project=Project.objects.get(id=plasmid_project),
                                  )
            # Plasmid needs pk before assigning many-to-many attributes
            new_plasmid.save()

            # Add plasmid alias from filename
            plasmid_alias = PlasmidAlias(alias=plasmid_filename, plasmid=new_plasmid)
            plasmid_alias.save()

            # Assign features to plasmid
            print('Adding Features...')
            if dnassembly_plasmid.features:
                feature_list = list()
                for dnassembly_feature in dnassembly_plasmid.features:
                    # Add features to database if required
                    if request.POST.get('features'):
                        # Check database features for duplication
                        if Feature.objects.filter(sequence=dnassembly_feature.sequence).exists():
                            feature_list.append(Feature.objects.get(sequence=dnassembly_feature.sequence))
                        else:
                            plasmid_feature = Feature(creator=request.user,
                                                      sequence=dnassembly_feature.sequence,
                                                      name=dnassembly_feature.name, )
                            plasmid_feature.save()
                            feature_list.append(plasmid_feature)
                    # Check database for feature
                    else:
                        if Feature.objects.filter(sequence=dnassembly_feature.sequence).exists():
                            feature_list.append(Feature.objects.get(sequence=dnassembly_feature.sequence))

                # todo: annotate new plasmids with existing features in database
                # Add features to plasmid
                new_plasmid.feature.add(*feature_list)

            # Assign Attributes to plasmid
            if plasmid_attributes and plasmid_attributes != '':
                attr_indicies = [int(a) for a in plasmid_attributes]
                attribute_list = list()
                for attribute in attr_indicies:
                    current_attribute = Attribute.objects.get(id=attribute)
                    attribute_list.append(current_attribute)
                new_plasmid.attribute.add(*attribute_list)

            # Automatically annotate plasmid parts/cassettes
            moclo_parts = annotate_moclo(new_plasmid.sequence)
            if moclo_parts:
                attribute_list = list()
                for part in moclo_parts:
                    print(part)
                    current_attribute = Attribute.objects.filter(name=f'Part {part}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)
            moclo_cassette = annotate_moclo(new_plasmid.sequence, annotate='cassette')
            if moclo_cassette:
                attribute_list = list()
                for cassette in moclo_cassette:
                    current_attribute = Attribute.objects.filter(name=f'Con {cassette}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)

            # Report
            response_dict['success'] = True
            current_creator = str(new_plasmid.project)
            current_creator_index = int(new_plasmid.projectindex)
            response_dict['plasmid_id'] = (current_creator, current_creator_index)

        # Catch Exceptions
        except SequenceException as e:
            print('Upload failed...' + str(e))
            response_dict['error'] = str(e)
        except Exception as e:
            print('Upload failed...' + str(e))
            response_dict['error'] = str(e)

    return JsonResponse(response_dict, status=200)


@login_required
def standard_assembly(request):
    """
    Performs MoClo assembly assuming standardized parts and pushes to database
    """
    print(request.POST)
    post_data = json.loads(request.POST['data'])
    reaction_project = Project.objects.get(id=int(post_data['ReactionProject']))

    # Get Reaction Definitions
    reaction_type = post_data.get('ReactionType')
    if reaction_type == 'goldengate':
        enzyme_dict = {'BbsI': BbsI, 'BsmBI': BsmBI}
        reaction_enzyme = enzyme_dict[post_data.get('ReactionEnzyme')]

    assembly_results = dict()
    assembly_index_dict = post_data.get('AssemblyRows')

    for index, assembly_dict in assembly_index_dict.items():
        # Keep track of current reaction status
        assembly_results[index] = dict()

        # Unpack dictionary
        index_list = assembly_dict['parts']
        assembly_alias = assembly_dict['alias']

        # Get plasmids for each assembly (row)
        assembly_db_plasmids = [Plasmid.objects.get(id=plasmid_id) for plasmid_id in set(index_list)]
        assembly_plasmid_pool = [plasmid.as_dnassembly() for plasmid in assembly_db_plasmids]
        assembly_ids = [plasmid.get_standard_id() for plasmid in assembly_db_plasmids]
        assembly_results[index]['reaction_plasmids'] = ', '.join(assembly_ids)

        try:
            gg_rxn = StickyEndAssembly(assembly_plasmid_pool, reaction_enzyme)
            gg_rxn.digest()
            assembly_product = gg_rxn.perform_assembly()

            new_plasmid = Plasmid(project=reaction_project,
                                  sequence=assembly_product.sequence,
                                  creator=request.user,
                                  description=assembly_product.description)

            # Circularly permute plasmid so sequence always starts with BbsI/BsmBI site if they exist
            new_plasmid = circularly_permute_plasmid(new_plasmid)

            plasmid_attributes = [plasmid.get_attributes_as_string() for plasmid in assembly_db_plasmids]
            seen_description_list = list()
            new_description_list = list()

            # Use Part 2-4 for cassette assembly description
            if post_data.get('ReactionEnzyme') == 'BbsI':
                for part in ['Part 2a', 'Part 2b', 'Part 3a', 'Part 3b','Part 3c','Part 3d','Part 3e', 'Part 4a', 'Part 4b']:
                    for attribute, part_plasmid in zip(plasmid_attributes, assembly_db_plasmids):
                        if part in attribute and part_plasmid not in seen_description_list:
                            new_description_list.append(part_plasmid.description)
                            seen_description_list.append(part_plasmid)

            # Use cassette descriptions for multicassette assembly description
            elif post_data.get('ReactionEnzyme') == 'BsmBI':
                for attribute, part_plasmid in zip(plasmid_attributes, assembly_db_plasmids):
                    new_description_list.append(part_plasmid.description)
                    seen_description_list.append(part_plasmid)

            new_description = '|'.join(new_description_list)
            new_plasmid.description = new_description

            new_plasmid.save()

            # Pull features from assembly_product and associate with new_plasmid
            # new_plasmid_features = [Feature.objects.get(sequence=feature.sequence) for feature in assembly_product.features]

            new_plasmid_features = []
            for feature in assembly_product.features:
                new_features = Feature.objects.filter(sequence=feature.sequence)
                if new_features.count() > 0:
                    for new_feature in new_features:
                        new_plasmid_features.append(new_feature)

            new_plasmid.feature.add(*new_plasmid_features)

            # Keep track of plasmids that went into assembly (Plasmid.assembly)
            # new_plasmid.assembly.add(*assembly_db_plasmids)
            for input_plasmid in assembly_db_plasmids:
                new_product_input = PlasmidAssembly(product=new_plasmid, input=input_plasmid)
                new_product_input.save()

            # Annotate part plasmid, if applicable
            print('Annotating Parts...')
            moclo_parts = annotate_moclo(new_plasmid.sequence)
            if moclo_parts:
                attribute_list = list()
                for part in moclo_parts:
                    current_attribute = Attribute.objects.filter(name=f'Part {part}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)

            # Annotate cassette plasmid, if applicable
            moclo_cassette = annotate_moclo(new_plasmid.sequence, annotate='cassette')
            if moclo_cassette:
                attribute_list = list()
                for cassette in moclo_cassette:
                    current_attribute = Attribute.objects.filter(name=f'Con {cassette}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)

            # Associate alias if applicable
            if assembly_alias and assembly_alias.strip() != "":
                plasmid_alias = PlasmidAlias(alias=assembly_alias.strip(), plasmid=new_plasmid)
                plasmid_alias.save()

            assembly_results[index]['success'] = True
            assembly_results[index]['new_plasmid'] = new_plasmid
            assembly_results[index]['assembly_id'] = f'{new_plasmid.project} {int(new_plasmid.projectindex)}'

        except AssemblyException as assembly_error:
            print(assembly_error)
            assembly_results[index]['success'] = False
            assembly_results[index]['error'] = str(assembly_error)

        except ReactionDefinitionException as definition_error:
            print(definition_error)
            assembly_results[index]['success'] = False
            assembly_results[index]['error'] = str(definition_error)

    request.session['assembly_type'] = 'cassette'
    request.session['results'] = assembly_results

    return JsonResponse({}, status=200)


@login_required
def part_assembly(request):
    """
    Performs MoClo assembly specifically for parts and pushes to database
    :return:
    """

    # Unpack POST data
    post_data = json.loads(request.POST.get('data'))
    entry_vector_id = int(post_data.get('entryVectorID'))
    dropin_vector = Plasmid.objects.get(id=entry_vector_id) #add this as an optional column in the POST?
    part_dict = post_data.get('parts')
    #addStandard = post_data.get('addStandard') #remove this button
    reaction_enzyme = BsmBI
    reaction_project = Project.objects.get(id=int(post_data.get('projectID')))
    possibleTemplates = post_data.get('possibleTemplates')

    # Prepare return data
    assembly_results = dict()

    response_dict = {}
    response_dict['results'] = {}
    response_dict['errors'] = []

    if len(part_dict) == 0:
        response_dict['errors'].append('No new parts were defined!')
        return JsonResponse(response_dict, status=200)

    for index, part_definition in part_dict.items():

        # Create new dict for part
        assembly_results[index] = {}

        # part_definition = [userDescription, [leftPartType, rightPartType], partSequence]
        userDescription = part_definition[0]
        leftPartType = part_definition[1][0]
        rightPartType = part_definition[1][1]
        partSequence = part_definition[2]

        method = 'None'
        fiveprime = ''
        threeprime = ''

        method = part_definition[3]

        if leftPartType == 'Custom':
            fiveprime = part_definition[4]

        if rightPartType == 'Custom':
            threeprime = part_definition[5]

        try:
            # Create dnassembly Part from sequence
            assembly_instructions = GGpart(userDescription, leftPartType, rightPartType, partSequence,
                                           dropin_vector.as_dnassembly(), method=method,
                                           fiveprime=fiveprime, threeprime=threeprime,
                                           possibleTemplates=possibleTemplates)

            new_plasmid = Plasmid(project=reaction_project,
                                  sequence=assembly_instructions.assembled_plasmid.sequence,
                                  creator=request.user,
                                  description=userDescription)

            # Circularly permute plasmid so sequence always starts with BbsI/BsmBI site if they exist
            new_plasmid = circularly_permute_plasmid(new_plasmid)

            # Pull Assembly instructions from GGPart and push to database
            # todo: push fragment and primer data to database
            assembly_ids = [f'{dropin_vector.get_standard_id()}']
            assembly_results[index]['reaction_plasmids'] = ', '.join(assembly_ids)
            assembly_results[index]['fragments'] = list()

            for fragment in assembly_instructions.fragments:
                fragment_dict = dict()
                fragment_dict['assembly_method'] = fragment.method
                print(fragment.primers[0])
                fragment_dict['primer_F'] = fragment.primers[0][0] if len(fragment.primers[0]) > 0 else ''
                fragment_dict['primer_R'] = fragment.primers[0][1] if len(fragment.primers[0]) > 0 else ''
                fragment_dict['template'] = fragment.template
                fragment_dict['product'] = fragment.product
                assembly_results[index]['fragments'].append(fragment_dict)

            assembly_results[index]['success'] = True
            assembly_results[index]['assembly_instructions'] = assembly_instructions
            assembly_results[index]['new_plasmid'] = new_plasmid
            assembly_results[index]['assembly_id'] = f''  # Populated with OPL if/when plasmid is commited to db

        except AssemblyException as assembly_error:
            print(assembly_error)
            assembly_results[index]['success'] = False
            assembly_results[index]['error'] = str(assembly_error)

        except ReactionDefinitionException as definition_error:
            print(definition_error)
            assembly_results[index]['success'] = False
            assembly_results[index]['error'] = str(definition_error)

    request.session['assembly_type'] = 'part'
    request.session['results'] = assembly_results

    return JsonResponse(response_dict, status=200)


@login_required
def assembly_result(request):
    """
    Report the result of a set of assemblies
    """
    assembly_results = request.session['results']
    assembly_type = request.session['assembly_type']
    print(assembly_results)

    commit_parts = request.POST.get('commitParts', False)
    print(f'Commit parts: {commit_parts}')

    if commit_parts:
        for index, assembly_result in assembly_results.items():

            # Pull new_plasmid from assembly_result
            new_plasmid = assembly_result['new_plasmid']
            new_plasmid.save()  # Save other aspects of the output?

            # Pull GGPart attributes
            assembly_instructions = assembly_result['assembly_instructions']
            plasmid_dnassembly = assembly_instructions.assembled_plasmid
            leftPartType = assembly_instructions.leftPartType
            rightPartType = assembly_instructions.rightPartType
            partSequence = assembly_instructions.partSeq
            userDescription = assembly_instructions.partName  # lol.

            # Pull features from assembly_product and associate with new_plasmid
            new_plasmid_features = []
            for feature in plasmid_dnassembly.features:
                new_plasmid_features.append(Feature.objects.get(sequence=feature.sequence))
                new_plasmid.feature.add(*new_plasmid_features)

            # Annotate part plasmid, if applicable
            print('Annotating Parts...')
            moclo_parts = annotate_moclo(new_plasmid.sequence)
            if moclo_parts:
                attribute_list = list()
                for part in moclo_parts:
                    current_attribute = Attribute.objects.filter(name=f'Part {part}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)

            # Annotate cassette plasmid, if applicable
            moclo_cassette = annotate_moclo(new_plasmid.sequence, annotate='cassette')
            if moclo_cassette:
                attribute_list = list()
                for cassette in moclo_cassette:
                    current_attribute = Attribute.objects.filter(name=f'Con {cassette}')
                    for attr in current_attribute:
                        attribute_list.append(attr)
                new_plasmid.attribute.add(*attribute_list)

            # Add partSequence as Feature for part 2/3/4
            if all([leftPartType[0] in ('2', '3', '4'), rightPartType[0] in ('2', '3', '4'),
                    leftPartType[0] == rightPartType[0]]):
                if len(Feature.objects.filter(sequence=partSequence)) == 0:
                    part_featuretype = FeatureType.objects.get(name='Part')
                    part_feature = Feature(name=userDescription, sequence=partSequence, creator=request.user,
                                           type=part_featuretype)
                    part_feature.save()
                    new_plasmid.feature.add(part_feature)

            # Export the plasmid to Benchling via API
            # benchling_request = postSeqBenchling(new_plasmid.sequence, new_plasmid.description, 'Kanamycin')
            #
            # partAlias = benchling_request['entityRegistryId'].strip()
            #
            # if partAlias and partAlias.strip() != "":
            #     plasmid_alias = PlasmidAlias(alias=partAlias, plasmid=new_plasmid)
            #     plasmid_alias.save()

            # todo: Update assembly results to reflect OPL Aliases
            # assembly_results[index]['assembly_id'] = partAlias

    return render(request, 'plasmid_database/clone/clone-assemblyresult.html', {'results': assembly_results,
                                                                                'assembly_type': assembly_type,
                                                                                'committed': commit_parts
                                                                                })

@login_required
def get_assembly_zip(request):
    # Format data for download into a .zip file
    zip_subdir = 'AssemblyInstructions'
    zip_filename = 'AssemblyInstructions.zip'

    response = HttpResponse(content_type='application/zip')
    zip_file = zipfile.ZipFile(response, 'w')

    # fill this in to zip up the context then download

    # Fix this part to
    # Create a DataFrame containing unique_plasmids
    AssemblyParts = pd.DataFrame(columns=['Part', 'Location', 'Description'])
    # unique_primers =
    # unique_fragments = #Start working from here

    for plasmid in assembly_results:
        unique_plasmid_info = pd.Series(index=['Part', 'Location', 'Description'])
        unique_plasmid_info['Part'] = (plasmid.get_aliases_as_string())
        unique_plasmid_info['Location'] = (plasmid.get_locations_as_string())
        unique_plasmid_info['Description'] = (plasmid.description)
        AssemblyParts = AssemblyParts.append(unique_plasmid_info, ignore_index=True)
        # TO-DO: look into how locations are stored

    # Add to ZIP

    # zip_path = os.path.join(zip_subdir, 'AssemblyParts.csv')
    AssemblyParts.to_csv('AssemblyParts.csv')
    zip_file.write('AssemblyParts.csv')

    zip_file.close()
    response['Content-Disposition'] = f'attachment;filename={zip_filename}'
    response['Content-Type'] = 'application/zip'
    return response

# --- Plasmid Features and Related Views --- #

@login_required
def manage_database(request):
    context = dict()
    context['current_user'] = request.user
    context['users'] = User.objects.all()
    context['projects'] = Project.objects.all()
    context['feature_types'] = FeatureType.objects.all()
    context['attribute_roots'] = Attribute.objects.filter(subcategory__isnull=True)
    context['attribute_roots_with_children'] = [attr.id for attr in context['attribute_roots'] if Attribute.objects.filter(subcategory=attr)]
    return render(request, 'plasmid_database/manage/manage.html', context)


@login_required
def update_feature(request):

    # --- Validate Request --- #

    user_id = int(request.user.id)
    response_dict = {'Success': False, 'Errors': []}

    if request.POST['action'] in ['update', 'delete']:
        requested_feature = int(request.POST['featureID'])
        feature_to_modify = Feature.objects.get(id=requested_feature)
        if feature_to_modify.creator.id != user_id:
            response_dict['Errors'].append('You can only edit your own features!')
            return JsonResponse(response_dict)

    elif request.POST['action'] == 'new':
        feature_to_modify = Feature(creator=User.objects.get(id=user_id))

    else:
        response_dict['Errors'].append('Invalid action!')
        return JsonResponse(response_dict)

    # --- Execute Request --- #

    # If delete, just delete. No validation needed
    if request.POST['action'] == 'delete':
        try:
            feature_to_modify.delete()
            response_dict['Success'] = True
        except Exception as e:
            print(e)
            response_dict['Success'] = False
            response_dict['Error'] = [str(e)]

    # Add or edit feature
    elif request.POST['action'] in ['new', 'update']:

        # Unpack Request
        feature_type_PK = int(request.POST['newType'])
        feature_name = request.POST['newName']
        feature_description = request.POST['newDescription']
        feature_sequence = request.POST['newSequence']

        # Validate new Feature Name and Sequence
        if feature_name is None or feature_name.strip() == '':
            response_dict['Errors'].append('Features require a name!')
        if re.fullmatch('^[ATCGatcg.]+$', feature_sequence) is None:
            response_dict['Errors'].append('Feature sequence can only contain [ATCG.]!')

        try:
            # Update name
            feature_to_modify.name = feature_name
            response_dict['newName'] = feature_name
            # Update type
            feature_type = FeatureType.objects.get(id=feature_type_PK)
            feature_to_modify.type = feature_type
            response_dict['newType'] = feature_type.name
            # Update description
            feature_to_modify.description = feature_description
            response_dict['newDescription'] = feature_description
            # Update sequence
            feature_to_modify.sequence = feature_sequence
            response_dict['newSequence'] = feature_sequence

            feature_to_modify.save()
            response_dict['Success'] = True

        except Exception as e:
            print(e)
            response_dict['Success'] = False
            response_dict['Error'] = [str(e)]

    return JsonResponse(response_dict)

# --- Attribute Dropdown Views --- #

@login_required
def get_attribute_tree(request):
    """Build tree JSON for JSTree"""
    atrtibute_tree = Attribute.populate_dropdown()
    return JsonResponse({'data': atrtibute_tree})


@login_required
def get_attribute_info(request):
    """Return attribute information"""
    attribute_id = request.POST['attr_id']
    requested_attribute = Attribute.objects.get(id=int(attribute_id))
    attribute_dict = dict()
    attribute_dict['Creator'] = str(requested_attribute.creator.username)
    attribute_dict['CreatorID'] = int(requested_attribute.creator.id)
    attribute_dict['Description'] = str(requested_attribute.description) if requested_attribute.description != '' else 'None.'
    attribute_dict['Name'] = str(requested_attribute.name)
    child_list = ', '.join([child.name for child in Attribute.objects.filter(subcategory__id=attribute_id)])
    attribute_dict['Children'] = child_list if child_list != '' else 'None.'
    attribute_dict['Parent'] = int(requested_attribute.subcategory.id) if requested_attribute.subcategory else None
    return JsonResponse(attribute_dict)


def add_attribute_to_database(request):
    """Add an attribute to the database"""
    new_attribute_name = request.POST['attribute_name']
    new_attribute_description = request.POST['attribute_description']

    exisiting_root_node_names = [str(attr.name).lower() for attr in Attribute.objects.all()]
    if new_attribute_name.lower() not in exisiting_root_node_names:
        current_subcategory = Attribute.objects.get(id=int(request.POST['parent_node'])) if request.POST['parent_node'] else None
        new_attribute = Attribute(name=new_attribute_name, description=new_attribute_description, creator=request.user, subcategory=current_subcategory)
        new_attribute.save()
        return JsonResponse({'success': True, 'Error': None})
    else:
        return JsonResponse({'success': False, 'Error': 'Root Attribute with that name already exists!'})


@login_required
def modify_attribute(request):
    user_id = int(request.user.id)
    requested_attribute = request.POST['attribute_id']
    attribute_to_modify = Attribute.objects.get(id=int(requested_attribute))
    modification = request.POST['modification']
    response_dict = dict()

    if attribute_to_modify.creator.id != user_id:
        response_dict['Success'] = False
        response_dict['Error'] = f'You can only {modification} your own attributes!'
    else:
        try:
            if modification == 'edit':
                attribute_to_modify.name = request.POST['new_name']
                attribute_to_modify.description = request.POST['new_description']
                attribute_to_modify.save()
            elif modification == 'delete':
                attribute_to_modify.delete()
            response_dict['Success'] = True
        except Exception as e:
            response_dict['Success'] = False
            response_dict['Error'] = str(e)
    return JsonResponse(response_dict)


@login_required
def get_attribute_children(request):
    """For jsTree if attribute/location trees become too big for a single request"""
    parent_pk = request.POST['attr_pk']
    part_children_qs = Attribute.objects.filter(subcategory=parent_pk)

    attribute_children = list()
    for attr in part_children_qs:
        attribute_children.append([attr.id, attr.name])
    nodes_with_children = [attr.id for attr in part_children_qs if Attribute.objects.filter(subcategory=attr)]
    print(sorted(attribute_children, key=lambda x: x[0]))
    print(nodes_with_children)
    return JsonResponse({'attr_children': sorted(attribute_children, key=lambda x: x[0]),
                         'nodes_with_children': nodes_with_children,
                         })


# --- Feature Table Views --- #

class FeatureDatatable(BaseDatatableView):
    model = Feature
    columns = ['id', 'name', 'description', 'sequence', 'type', 'creator']
    order_columns = ['id', 'name', 'description', 'sequence', 'type', 'creator']
    max_display_length = 10

    # Other things
    def render_column(self, row, column):
        return super(FeatureDatatable, self).render_column(row, column)

    def filter_queryset(self, qs):

        pprint(self.request.POST)

        column_index_mapping = {column: self.request.GET.get(f'columns[{index}][search][value]', None)
                                for index, column in enumerate(self.columns)}

        pprint(column_index_mapping)

        # Return unaltered qs if there is no user input
        if all([value in [None, ''] for value in column_index_mapping.values()]):
            return qs

        # Search
        else:
            column_querysets = list()
            for current_field, search_term in column_index_mapping.items():

                if search_term not in [None, '']:
                    if current_field in ['creator', 'type']:
                        term_filter = {f'{current_field}__id__iexact': search_term}
                        column_querysets.append(qs.filter(**term_filter))

                    else:
                        # Check if input is valid regex
                        try:
                            re.compile(search_term)
                            is_valid = True
                        except re.error:
                            is_valid = False

                        search_method = 'iregex' if is_valid else 'icontains'

                        term_filter = {f'{current_field}__{search_method}': search_term}
                        column_querysets.append(qs.filter(**term_filter))

            if len(column_querysets) == 1:
                return column_querysets[0].distinct()
            else:
                return column_querysets[0].intersection(*column_querysets[1:]).distinct()

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(int(item.id)),
                escape(str(item.name.capitalize())),
                str(item.description),
                str(item.sequence),
                str(item.type.name) if item.type is not None else str(item.type),
                str(item.creator),
            ])
        return json_data

# --- User/Plasmid specific views --- #

@login_required
def user_plasmids(request, user_id):
    return HttpResponse(f'Plasmids for user {user_id}')


@login_required
def plasmid(request, project_id, plasmid_id):
    database_projects = [project.project for project in Project.objects.all()]
    if project_id not in database_projects:
        raise Http404

    requested_plasmid = get_object_or_404(Plasmid, project__project=project_id, projectindex=plasmid_id)

    form = PlasmidFileForm()
    context = {}
    context['plasmid'] = requested_plasmid
    context['form'] = form
    context['plasmid_files'] = [filename for filename in requested_plasmid.files.all()]
    context['current_user'] = request.user
    context['attrString'] = json.dumps([f'Attribute-{attr.id}' for attr in requested_plasmid.attribute.all()])
    context['locString'] = json.dumps([f'Location-{loc.id}' for loc in requested_plasmid.location.all()])
    return render(request, 'plasmid_database/plasmid_page.html', context)


def update_plasmid(request):
    """Update location, attribute, and description information for a plasmid"""
    user_id = int(request.user.id)
    requested_plasmid = request.POST['plasmidPK']
    locationPKs = [int(loc) for loc in request.POST.getlist('locationPKs[]')]
    attributePKs = [int(attr) for attr in request.POST.getlist('attributePKs[]')]
    newDescription = request.POST['newDescription']

    plasmid_to_modify = Plasmid.objects.get(id=int(requested_plasmid))
    response_dict = dict()

    if plasmid_to_modify.creator.id != user_id:
        response_dict['Success'] = False
        response_dict['Error'] = f'You can only edit your own plasmids!'
    else:
        try:
            # Update description
            plasmid_to_modify.description = newDescription
            response_dict['newDescription'] = newDescription
            # Update attributes
            plasmid_to_modify.attribute.clear()
            new_attributes = Attribute.objects.filter(id__in=attributePKs)
            attribute_list = [attr for attr in new_attributes]
            plasmid_to_modify.attribute.add(*attribute_list)
            response_dict['newAttributes'] = [attr.name for attr in attribute_list]
            # Update locations
            plasmid_to_modify.location.clear()
            new_locations = Location.objects.filter(id__in=locationPKs)
            location_list = [loc for loc in new_locations]
            plasmid_to_modify.location.add(*location_list)
            response_dict['newLocations'] = [loc.name for loc in location_list]

            print('Updating description!')
            plasmid_to_modify.save(update_fields=['description'], force_update=True)
            print('description updated...')

            print(response_dict['newDescription'])
            print(response_dict['newAttributes'])
            print(response_dict['newLocations'])
            response_dict['Success'] = True

        except Exception as e:
            print(e)
            response_dict['Success'] = False
            response_dict['Error'] = [str(e)]
    return JsonResponse(response_dict)


def update_alias(request):
    """Create or remove plasmid aliases"""
    user_id = int(request.user.id)
    plasmid_pk = int(request.POST['plasmid'])
    alias = request.POST['alias']
    action = request.POST['action']

    requested_plasmid = Plasmid.objects.get(id=plasmid_pk)
    if user_id != requested_plasmid.creator.id:
        return JsonResponse({'Success': False, 'Error': ['You can only edit your own plasmids!']})

    if action == 'delete':
        requested_plasmid_alias = PlasmidAlias.objects.get(plasmid=requested_plasmid, alias=alias)
        requested_plasmid_alias.delete()
        return JsonResponse({'Success': True, 'Error': []})
    elif action == 'add':
        plasmid_alias = PlasmidAlias(alias=alias, plasmid=requested_plasmid)
        plasmid_alias.save()
        return JsonResponse({'Success': True, 'Error': []})
    else:
        return JsonResponse({'Success': False, 'Error': ['Invalid action!']})


def update_file(request):
    """Create or remove plasmid files"""
    user_id = int(request.user.id)
    plasmid_pk = int(request.POST.get('plasmidpk', 0))
    file_description = request.POST.get('description', '')
    file_obj = request.FILES.get('file', None)
    action = request.POST.get('action', None)
    next = request.POST.get('next', '/')

    if action == 'create':
        requested_plasmid = Plasmid.objects.get(id=plasmid_pk)

        # Timestamp new file
        original_filename = file_obj.name
        file_obj.name = f'{int(time.time())}-{original_filename}'

        # New file
        new_file = PlasmidFile()
        new_file.file = file_obj
        new_file.filename = original_filename
        new_file.plasmid = requested_plasmid
        new_file.description = file_description
        new_file.creator = request.user
        new_file.save()

    if action == 'delete':
        file_id = int(request.POST['file_id'])
        requested_file = PlasmidFile.objects.get(id=file_id)
        if user_id != requested_file.creator.id:
            return redirect(next)

        requested_file.delete()

    return redirect(next)


def download_file(request):
    """Download plasmid page files"""
    file_id = int(request.POST['file_id'])
    requested_file = PlasmidFile.objects.get(id=file_id)
    s3 = boto3.client('s3')
    url = s3.generate_presigned_url(ClientMethod='get_object',
                                    Params={
                                        'Bucket': os.environ.get('AWS_STORAGE_BUCKET_NAME'),
                                        'Key': str(requested_file.file),
                                    })
    return redirect(url)


def delete_comment(request):
    """Delete a comment"""
    next = request.POST.get('next', '/')
    user_id = int(request.user.id)
    comment_id = int(request.POST.get('comment_id', 0))

    comment = Comment.objects.get(id=comment_id)
    if comment.user.id == user_id:
        comment.delete()

    return redirect(next)


def snapgene_request(request):
    """Get snapgene things"""

    import zmq
    import tempfile
    from django.contrib.staticfiles.storage import staticfiles_storage

    requested_plasmidpk = request.POST.get('plasmidPK')
    plasmid = Plasmid.objects.get(id=requested_plasmidpk)

    with tempfile.TemporaryDirectory() as snapscratch:
        # Write plasmid genbank to tempdir
        plasmid_name_gb = f'{plasmid.get_standard_id()}.gb'
        plasmid_name_dna = f'{plasmid.get_standard_id()}.dna'

        plasmid_genbank_path = os.path.join(snapscratch, plasmid_name_gb)
        plasmid_genbank = plasmid.as_dnassembly()
        dnassembly.io.write_genbank(plasmid_genbank, output=plasmid_genbank_path)

        # Create .dna file
        zmq_context = zmq.Context()
        socket = zmq_context.socket(zmq.REQ)
        socket.connect("tcp://localhost:5556")
        plasmid_dna_path = os.path.join(snapscratch, plasmid_name_dna)
        snapgene_json = {'request': 'importDNAFile',
                         'inputFile': plasmid_genbank_path,
                         'outputFile': plasmid_dna_path}
        socket.send_json(snapgene_json)
        response = socket.recv_json()
        print(response)
        socket.close()

        # Generate svg map
        plasmid_dom_path = os.path.join(snapscratch, f'{plasmid.get_standard_id()}.txt')
        snapgene_json = {'request': 'generateSVGMap',
                         'inputFile': plasmid_dna_path,
                         'outputSvgDom': plasmid_dom_path
                         }
        zmq_context = zmq.Context()
        socket = zmq_context.socket(zmq.REQ)
        socket.connect("tcp://localhost:5556")
        socket.send_json(snapgene_json)
        response = socket.recv_json()
        socket.close()

        # Generate svg sequence
        plasmid_dom_seq_path = os.path.join(snapscratch, f'{plasmid.get_standard_id()}_seq.txt')
        plasmid_dom_seq_outputSvgJSStatic = os.path.join(snapscratch, f'{plasmid.get_standard_id()}_outputSvgJSStatic.txt')
        plasmid_dom_seq_outputSvgJSDynamic = os.path.join(snapscratch, f'{plasmid.get_standard_id()}_outputSvgJSDynamic.txt')
        plasmid_dom_seq_outputSvgCss = os.path.join(snapscratch, f'{plasmid.get_standard_id()}_outputSvgCss.txt')

        snapgene_json = {'request': 'generateSVGSequence',
                         'inputFile': plasmid_dna_path,
                         'outputSvgDom': plasmid_dom_seq_path,
                         'outputSvgJSStatic': plasmid_dom_seq_outputSvgJSStatic,
                         'outputSvgJSDynamic': plasmid_dom_seq_outputSvgJSDynamic,
                         'outputSvgCss': plasmid_dom_seq_outputSvgCss,
                         }
        zmq_context = zmq.Context()
        socket = zmq_context.socket(zmq.REQ)
        socket.connect("tcp://localhost:5556")
        socket.send_json(snapgene_json)
        response = socket.recv_json()
        socket.close()

        with open(plasmid_dom_path, 'r') as html:
            dom_context = html.read()
        with open(plasmid_dom_seq_path, 'r') as html_seq:
            dom_context_seq = html_seq.read()
        with open(plasmid_dom_seq_outputSvgJSStatic, 'r') as html_seq:
            seqJSstatic = html_seq.read()
        with open(plasmid_dom_seq_outputSvgJSDynamic, 'r') as html_seq:
            seqJSdynamic = html_seq.read()
        with open(plasmid_dom_seq_outputSvgCss, 'r') as html_seq:
            seqCSS = html_seq.read()

    return JsonResponse({'svg_html': dom_context,
                         'seq_html': dom_context_seq,
                         'seqJSstatic': seqJSstatic,
                         'seqJSdynamic': seqJSdynamic,
                         'seqCSS': seqCSS,
                         })
