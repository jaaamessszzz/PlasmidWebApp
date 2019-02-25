import io
import os
import json
from datetime import datetime
from pprint import pprint

from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.utils.html import escape
from django_datatables_view.base_datatable_view import BaseDatatableView

import dnassembly
import zipfile

from .models import Plasmid, User, Project, Feature, Attribute
from .forms import SignUpForm

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

# --- Plasmid Datatables --- #

class plasmidDatatable(BaseDatatableView):

    model = Plasmid
    columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description', 'location', 'creator', 'created']
    order_columns = ['id', 'project', 'projectindex', 'feature', 'attribute', 'description', 'location', 'creator', 'created']
    max_display_length = 100

    # Other things
    def render_column(self, row, column):
        return super(plasmidDatatable, self).render_column(row, column)

    def filter_queryset(self, qs):

        # todo: get column indicies directly from datatable... somehow...
        column_index_mapping = {7: {'field': 'project'},
                                6: {'field': 'projectindex'},
                                5: {'field': 'feature'},
                                4: {'field': 'attribute'},
                                3: {'field': 'description'},
                                2: {'field': 'location'},
                                1: {'field': 'creator'},
                                0: {'field': 'created'},
                                }

        for index in column_index_mapping:
            column_index_mapping[index]['search_term'] = self.request.GET.get(f'columns[{index}][search][value]', None)

        # Return unaltered qs if there is no user input
        if all([column_index_mapping[index]['search_term'] in [None, ''] for index in column_index_mapping]):
            return qs

        # Search
        else:
            column_querysets = list()
            for index in column_index_mapping:
                current_field = column_index_mapping[index]['field']
                search_term = column_index_mapping[index]['search_term']

                if search_term not in [None, '']:
                    if current_field == 'creator':
                        term_filter = {f'{current_field}__id__iexact': search_term}
                    elif current_field == 'project':
                        term_filter = {f'{current_field}__id__iexact': search_term}
                    elif current_field == 'projectindex':
                        term_filter = {f'{current_field}__exact': int(search_term)}
                    else:
                        # Check if input is valid regex
                        try:
                            re.compile(search_term)
                            is_valid = True
                        except re.error:
                            is_valid = False
                        search_method = 'iregex' if is_valid else 'icontains'

                        if current_field in ['feature', 'attribute', 'location']:
                            term_filter = {f'{current_field}__name__{search_method}': search_term}
                        else:
                            term_filter = {f'{current_field}__{search_method}': search_term}

                    column_querysets.append(qs.filter(**term_filter))

            if len(column_querysets) == 1:
                return column_querysets[0]
            else:
                return column_querysets[0].intersection(*column_querysets[1:])

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
    return response

@login_required
def database(request):
    context = {
        'users': User.objects.all(),
        'projects': Project.objects.all(),
    }
    return render(request, 'database.html', context)

# --- Add Plasmid and Related Views --- #

import io
import re
import dnassembly
from dnassembly import SequenceException, StickyEndAssembly
from dnassembly import AssemblyException, ReactionDefinitionException
from Bio.Restriction import BsaI, BsmBI

@login_required
def add_plasmids(request):
    context = dict()
    context['users'] = User.objects.all()
    context['projects'] = Project.objects.all()
    context['attribute_roots'] = Attribute.objects.filter(subcategory__isnull=True)
    context['roots_with_children'] = [attr.id for attr in context['attribute_roots'] if Attribute.objects.filter(subcategory=attr)]
    return render(request, 'clone.html', context)


class PlasmidFilterDatatable(BaseDatatableView):

    model = Plasmid
    columns = ['project', 'id', 'projectindex', 'feature', 'attribute', 'description']
    order_columns = ['project', 'id', 'projectindex', 'feature', 'attribute', 'description']
    max_display_length = 10

    def render_column(self, row, column):
        return super(PlasmidFilterDatatable, self).render_column(row, column)

    def filter_queryset(self, qs):

        column_index_mapping = {0: {'field': 'description'},
                                1: {'field': 'attribute'},
                                2: {'field': 'feature'},
                                3: {'field': 'projectindex'},
                                5: {'field': 'project'},
                                }

        pprint(self.request.GET)

        for index in column_index_mapping:
            column_index_mapping[index]['search_term'] = self.request.GET.get(f'columns[{index}][search][value]', None)

        # Return unaltered qs if there is no user input
        if all([column_index_mapping[index]['search_term'] in [None, ''] for index in column_index_mapping]):
            return qs

        # Search
        else:
            column_querysets = list()
            for index in column_index_mapping:
                current_field = column_index_mapping[index]['field']
                search_term = column_index_mapping[index]['search_term']

                if search_term not in [None, '']:
                    if current_field == 'creator':
                        term_filter = {f'{current_field}__id__iexact': search_term}
                    elif current_field == 'project':
                        term_filter = {f'{current_field}__id__iexact': search_term}
                    elif current_field == 'projectindex':
                        term_filter = {f'{current_field}__exact': int(search_term)}
                    else:
                        # Check if input is valid regex
                        try:
                            re.compile(search_term)
                            is_valid = True
                        except re.error:
                            is_valid = False
                        search_method = 'iregex' if is_valid else 'icontains'

                        if current_field in ['feature', 'attribute', 'location']:
                            term_filter = {f'{current_field}__name__{search_method}': search_term}
                        else:
                            term_filter = {f'{current_field}__{search_method}': search_term}

                    column_querysets.append(qs.filter(**term_filter))

            if len(column_querysets) == 1:
                return column_querysets[0]
            else:
                return column_querysets[0].intersection(*column_querysets[1:])

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(str(item.project.project).capitalize()),
                escape(int(item.id)),
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
            if dnassembly_plasmid.features:
                feature_list = list()
                for dnassembly_feature in dnassembly_plasmid.features:
                    # Add features to database if required
                    print(request.POST.get('features'))
                    if request.POST.get('features'):
                        print('Adding Features!')
                        # Check database features for duplication
                        if Feature.objects.filter(creator=request.user, sequence=dnassembly_feature.sequence).exists():
                            feature_list.append(Feature.objects.get(creator=request.user, sequence=dnassembly_feature.sequence))
                            print('Feature is already in database.')
                        else:
                            plasmid_feature = Feature(creator=request.user,
                                                      sequence=dnassembly_feature.sequence,
                                                      name=dnassembly_feature.name, )
                            plasmid_feature.save()
                            print('Made a new feature.')
                            feature_list.append(plasmid_feature)
                    # Check database for feature
                    else:
                        if Feature.objects.filter(creator=request.user, sequence=dnassembly_feature.sequence).exists():
                            feature_list.append(Feature.objects.get(creator=request.user, sequence=dnassembly_feature.sequence))

                # todo: annotate new plasmids with existing features in database
                # Add features to plasmid
                new_plasmid.feature.add(*feature_list)

            # Assign Attributes to plasmid
            if plasmid_attributes:
                attribute_list = list()
                for attribute in plasmid_attributes:
                    current_attribute = Attribute.objects.get(id=attribute)
                    attribute_list.append(current_attribute)
                new_plasmid.attribute.add(*attribute_list)

            # Report
            response_dict['success'] = True
            current_creator = str(new_plasmid.project)
            current_creator_index = int(new_plasmid.projectindex)
            response_dict['plasmid_id'] = (current_creator, current_creator_index)
            response_dict['filename'] = str(uploaded_file.name)

        # Catch Exceptions
        except SequenceException as e:
            print('Upload failed...' + e)
            response_dict['error'] = str(e)
        except Exception as e:
            print('Upload failed...' + e)
            response_dict['error'] = str(e)

    return JsonResponse(response_dict, status=200)

@login_required
def perform_assemblies(request):
    post_data = json.loads(request.POST['data'])
    print(post_data)
    reaction_project = Project.objects.get(id=int(post_data['ReactionProject']))

    # Get master mix plasmids
    master_mix_plasmids = list()
    for master_mix_plasmid in post_data['MasterMix']:
        master_mix_plasmids.append(Plasmid.objects.get(id=master_mix_plasmid))

    assembly_mixins = list()
    # Get drop-in plasmids
    for drop_in_plasmid in post_data['DropIn']:
        assembly_mixins.append([Plasmid.objects.get(id=drop_in_plasmid)])

    # Get defined parts
    for defined_part in post_data['DefinedParts']:
        assembly_mixins.append(defined_part)

    # Get Reaction Definitions
    enzyme_dict = {'BsaI': BsaI, 'BsmBI': BsmBI}
    reaction_enzyme = enzyme_dict[post_data.get('ReactionEnzyme')]
    reaction_type = post_data.get('ReactionType')

    response_data = dict()

    master_mix_dna = [plasmid.as_dnassembly() for plasmid in master_mix_plasmids]
    master_mix_ids = [[str(plasmid.creator), int(plasmid.projectindex)] for plasmid in master_mix_plasmids]

    # Enumerate and perform assembly for each drop-in
    for index, drop_in_set in enumerate(assembly_mixins, start=1):
        # Keep track of current reaction status
        response_data[index] = dict()

        if type(drop_in_set) is dict:
            defined_part_dna = [dnassembly.Part(name=defined_part['PartID'],
                                                entity_id=defined_part['PartID'],
                                                sequence=defined_part['PartSequence']
                                                )]
            assembly_plasmid_pool = master_mix_dna + defined_part_dna
            response_data[index]['DefinedPart'] = defined_part['PartID']
            response_data[index]['reaction_plasmids'] = master_mix_ids

        else:
            assembly_plasmid_pool = master_mix_dna + [plasmid.as_dnassembly() for plasmid in drop_in_set]
            assembly_plasmid_id_list = master_mix_ids + [[str(plasmid.creator), int(plasmid.projectindex)] for plasmid in drop_in_set]
            response_data[index]['reaction_plasmids'] = assembly_plasmid_id_list

        # todo: catch and handle errors...
        if reaction_type == 'goldengate':
            try:
                gg_rxn = StickyEndAssembly(assembly_plasmid_pool, reaction_enzyme)
                gg_rxn.digest()
                assembly_product = gg_rxn.perform_assembly()
                new_plasmid = Plasmid(project=reaction_project,
                                      sequence=assembly_product.sequence,
                                      creator=request.user,
                                      description=assembly_product.description)
                new_plasmid.save()
                print(new_plasmid)

                # todo: pull features from new_plasmid and associate with new entry
                response_data[index]['success'] = True
                response_data[index]['assembly_id'] = int(new_plasmid.projectindex)

            except AssemblyException as assembly_error:
                print(assembly_error)
                response_data[index]['success'] = False
                response_data[index]['error'] = str(assembly_error)

            except ReactionDefinitionException as definition_error:
                print(definition_error)
                response_data[index]['success'] = False
                response_data[index]['error'] = str(definition_error)

    return JsonResponse(response_data, status=200)

# --- Plasmid Features and Related Views --- #

@login_required
def features(request):
    context = {}
    return render(request, 'manage.html', context)

# --- Attribute/Location Dropdown views --- #

@login_required
def get_attribute_children(request):
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

# --- User/Plasmid specific views --- #

@login_required
def user_plasmids(request, user_id):
    return HttpResponse(f'Plasmids for user {user_id}')

@login_required
def plasmid(request, user_id, plasmid_id):
    return HttpResponse(f'Page for plasmid {user_id, plasmid_id}')
