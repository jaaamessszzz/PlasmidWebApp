import io
import os
import json
import zipfile
from datetime import datetime
from pprint import pprint

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, Http404
from django.utils.html import escape
from django_datatables_view.base_datatable_view import BaseDatatableView

import dnassembly
from dnassembly.utils.annotation import annotate_moclo
from dnassembly.reactions.moclo import MoCloPartFromSequence

from .models import Plasmid, User, Project, Feature, Attribute, Location, FeatureType
from .forms import SignUpForm

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
            return redirect('home')
    else:
        form = SignUpForm()
    return render(request, 'registration/signup.html', {'form': form})

# --- Template Datatable View --- #

class FilterDatatableTemplate(BaseDatatableView):

    def filter_queryset(self, qs):

        pprint(self.request.POST)

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

                        else:
                            term_filter = {f'{current_field}__{search_method}': search_term}
                            column_querysets.append(qs.filter(**term_filter))

            if len(column_querysets) == 1:
                return column_querysets[0].distinct()
            else:
                return column_querysets[0].intersection(*column_querysets[1:]).distinct()

# --- Plasmid Datatables --- #

class PlasmidDatatable(FilterDatatableTemplate):

    model = Plasmid
    columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description', 'location', 'creator', 'created']
    order_columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description', 'location', 'creator', 'created']
    max_display_length = 100

    def render_column(self, row, column):
        return super(PlasmidDatatable, self).render_column(row, column)

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(int(item.id)),
                escape(str(item.project.project).capitalize()),
                escape(item.projectindex),
                item.get_features_as_string(),
                item.get_attributes_as_string(),
                item.description,
                item.get_locations_as_string(),
                str(item.creator),
                item.created.strftime('%Y-%m-%d %H:%M:%S')
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
        dnassembly.write_genbank(plasmid_genbank, output=plasmid_io, to_stream=True)
        plasmid_io.seek(0)
        # Add to ZIP
        zip_path = os.path.join(zip_subdir, plasmid_name)
        zip_file.writestr(zip_path, plasmid_io.read())

    zip_file.close()
    response['Content-Disposition'] = f'attachment;filename={zip_filename}'
    response['Content-Type'] = 'application/zip'
    return response

@login_required
def database(request):
    context = {
        'users': User.objects.all(),
        'projects': Project.objects.all(),
    }
    return render(request, 'database.html', context)

# --- Add Plasmid and Related Views --- #
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
from dnassembly import SequenceException, StickyEndAssembly
from dnassembly import AssemblyException, ReactionDefinitionException, SequenceException
from Bio.Restriction import BsaI, BsmBI

@login_required
def add_plasmids(request):
    context = dict()
    context['users'] = User.objects.all()
    context['projects'] = Project.objects.all()
    context['attribute_roots'] = Attribute.objects.filter(subcategory__isnull=True)
    context['roots_with_children'] = [attr.id for attr in context['attribute_roots'] if Attribute.objects.filter(subcategory=attr)]
    context['partEntryVectors'] = Plasmid.objects.filter(attribute__name='Part Entry Vector')
    return render(request, 'clone/clone.html', context)


class PlasmidFilterDatatable(FilterDatatableTemplate):

    model = Plasmid
    columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description']
    order_columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description']
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
                item.get_features_as_string(),
                item.get_attributes_as_string(),
                item.description,
            ])
        return json_data


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
        dnassembly_plasmid = dnassembly.read_genbank(upload_stringio, dnassembly.ReadAs.Plasmid)

        try:
            # Add plasmid to database
            new_plasmid = Plasmid(sequence=dnassembly_plasmid.sequence,
                                  creator=request.user,
                                  description=dnassembly_plasmid.description,
                                  project=Project.objects.get(id=plasmid_project),
                                  )
            # Plasmid needs pk before assigning many-to-many attributes
            new_plasmid.save()

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
    Performs MoClo assembly and pushes to database
    """
    print(request.POST)
    post_data = json.loads(request.POST['data'])
    reaction_project = Project.objects.get(id=int(post_data['ReactionProject']))

    # Get Reaction Definitions
    reaction_type = post_data.get('ReactionType')
    if reaction_type == 'goldengate':
        enzyme_dict = {'BsaI': BsaI, 'BsmBI': BsmBI}
        reaction_enzyme = enzyme_dict[post_data.get('ReactionEnzyme')]

    assembly_results = dict()
    assembly_index_dict = post_data.get('AssemblyRows')

    for index, index_list in assembly_index_dict.items():
        # Keep track of current reaction status
        assembly_results[index] = dict()

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
            new_plasmid.save()

            # Pull features from assembly_product and associate with new_plasmid
            new_plasmid_features = []
            for feature in assembly_product.features:
                new_plasmid_features.append(Feature.objects.get(sequence=feature.sequence))
            new_plasmid.feature.add(*new_plasmid_features)

            # Keep track of plasmids that went into assembly (Plasmid.assembly)
            new_plasmid.assembly.add(*assembly_db_plasmids)

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
    dropin_vector = Plasmid.objects.get(id=entry_vector_id)
    part_dict = post_data.get('parts')
    addStandard = post_data.get('addStandard')
    reaction_enzyme = BsmBI
    reaction_project = Project.objects.get(id=int(post_data.get('projectID')))

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

        # part_definition = [[leftPartOverhang, rightPartOverhang], partSequence, userDescription]
        leftPartOverhang = part_definition[0][0]
        rightPartOverhang = part_definition[0][1]
        partSequence = part_definition[1]
        userDescription = part_definition[2]

        # Create dnassembly Part from sequence
        user_defined_part = MoCloPartFromSequence(partSequence, leftPartOverhang, rightPartOverhang, description=userDescription, standardize=addStandard)

        # Get plasmids for each assembly (row)
        assembly_plasmid_pool = [dropin_vector.as_dnassembly(), user_defined_part]
        assembly_ids = [f'{str(dropin_vector.project)} {int(dropin_vector.projectindex)}']
        assembly_results[index]['reaction_plasmids'] = ', '.join(assembly_ids)

        try:
            gg_rxn = StickyEndAssembly(assembly_plasmid_pool, reaction_enzyme)
            gg_rxn.digest()
            assembly_product = gg_rxn.perform_assembly()

            new_plasmid = Plasmid(project=reaction_project,
                                  sequence=assembly_product.sequence,
                                  creator=request.user,
                                  description=assembly_product.description)
            new_plasmid.save()

            # Pull features from assembly_product and associate with new_plasmid
            new_plasmid_features = []
            for feature in assembly_product.features:
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
            if all([leftPartOverhang[0] in ('2', '3', '4'), rightPartOverhang[0] in ('2', '3', '4'), leftPartOverhang[0] == rightPartOverhang[0]]):
                part_featuretype = FeatureType.objects.get(name='Part')
                part_feature = Feature(name=userDescription, sequence=partSequence, creator=request.user, type=part_featuretype)
                part_feature.save()

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

    request.session['results'] = assembly_results

    return JsonResponse(response_dict, status=200)


@login_required
def assembly_result(request):
    """
    Report the result of a set of assemblies
    """
    assembly_results = request.session['results']
    print(assembly_results)
    return render(request, 'clone/clone-assemblyresult.html', {'results': assembly_results})


# --- Plasmid Features and Related Views --- #

@login_required
def manage_database(request):
    context = dict()
    context['current_user'] = request.user
    context['users'] = User.objects.all()
    context['projects'] = Project.objects.all()
    context['attribute_roots'] = Attribute.objects.filter(subcategory__isnull=True)
    context['attribute_roots_with_children'] = [attr.id for attr in context['attribute_roots'] if Attribute.objects.filter(subcategory=attr)]
    return render(request, 'manage/manage.html', context)

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
    attribute_children_qs = Attribute.objects.filter(subcategory=parent_pk)

    attribute_children = list()
    for attr in attribute_children_qs:
        attribute_children.append([attr.id, attr.name])
    nodes_with_children = [attr.id for attr in attribute_children_qs if Attribute.objects.filter(subcategory=attr)]
    print(sorted(attribute_children, key=lambda x: x[0]))
    print(nodes_with_children)
    return JsonResponse({'attr_children': sorted(attribute_children, key=lambda x: x[0]),
                         'nodes_with_children': nodes_with_children,
                         })

# --- Location Dropdown Views --- #

@login_required
def get_location_tree(request):
    """Build tree JSON for JSTree"""
    atrtibute_tree = Location.populate_dropdown()
    return JsonResponse({'data': atrtibute_tree})

@login_required
def get_location_info(request):
    """Return location information"""
    location_id = request.POST['loc_id']
    requested_location = Location.objects.get(id=int(location_id))
    location_dict = dict()
    location_dict['Creator'] = str(requested_location.creator.username)
    location_dict['CreatorID'] = int(requested_location.creator.id)
    location_dict['Description'] = str(requested_location.description) if requested_location.description != '' else 'None.'
    location_dict['Name'] = str(requested_location.name)
    child_list = ', '.join([child.name for child in Location.objects.filter(subcategory__id=location_id)])
    location_dict['Children'] = child_list if child_list != '' else 'None.'
    location_dict['Parent'] = int(requested_location.subcategory.id) if requested_location.subcategory else None
    return JsonResponse(location_dict)

def add_location_to_database(request):
    """Add an location to the database"""
    new_location_name = request.POST['location_name']
    new_location_description = request.POST['location_description']

    exisiting_root_node_names = [str(loc.name).lower() for loc in Location.objects.all()]
    if new_location_name.lower() not in exisiting_root_node_names:
        current_subcategory = Location.objects.get(id=int(request.POST['parent_node'])) if request.POST['parent_node'] else None
        new_location = Location(name=new_location_name, description=new_location_description, creator=request.user, subcategory=current_subcategory)
        new_location.save()
        return JsonResponse({'success': True, 'Error': None})
    else:
        return JsonResponse({'success': False, 'Error': 'Root Location with that name already exists!'})

@login_required
def modify_location(request):
    user_id = int(request.user.id)
    requested_location = request.POST['location_id']
    location_to_modify = Location.objects.get(id=int(requested_location))
    modification = request.POST['modification']
    response_dict = dict()

    if location_to_modify.creator.id != user_id:
        response_dict['Success'] = False
        response_dict['Error'] = f'You can only {modification} your own locations!'
    else:
        try:
            if modification == 'edit':
                location_to_modify.name = request.POST['new_name']
                location_to_modify.description = request.POST['new_description']
                location_to_modify.save()
            elif modification == 'delete':
                location_to_modify.delete()
            response_dict['Success'] = True
        except Exception as e:
            response_dict['Success'] = False
            response_dict['Error'] = str(e)
    return JsonResponse(response_dict)

# --- Feature Table Views --- #

@login_required
class FeatureDatatable(FilterDatatableTemplate):

    model = Plasmid
    columns = ['id', 'name', 'sequence', 'description', 'type', 'creator']
    order_columns = ['id', 'name', 'sequence', 'description', 'type', 'creator']
    max_display_length = 10

    # Other things
    def render_column(self, row, column):
        return super(FeatureDatatable, self).render_column(row, column)

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(int(item.id)),
                escape(str(item.name.capitalize())),
                str(item.sequence),
                str(item.description),
                str(item.type),
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
    context = {}
    context['plasmid'] = requested_plasmid
    context['current_user'] = request.user
    context['attrString'] = json.dumps([f'Attribute-{attr.id}' for attr in requested_plasmid.attribute.all()])
    context['locString'] = json.dumps([f'Location-{loc.id}' for loc in requested_plasmid.location.all()])
    return render(request, 'plasmid_page.html', context)

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
