from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
from django.utils.html import escape
from .models import Plasmid, User

import json

# Create your views here.

# --- Plasmid Datatables --- #

import django_datatables_view
from django_datatables_view.base_datatable_view import BaseDatatableView


class plasmidDatatable(BaseDatatableView):

    model = Plasmid
    columns = ['creator', 'creatorindex', 'description', 'created']
    order_columns = ['creator', 'creatorindex', '', 'created']
    max_display_length = 100

    def render_column(self, row, column):
        return super(plasmidDatatable, self).render_column(row, column)

    def filter_queryset(self, qs):
        print(self.request.POST.get('search[value]', None))
        return qs

    def prepare_results(self, qs):
        json_data = []
        for item in qs:
            json_data.append([
                escape(str(item.creator).capitalize()),
                escape(item.creatorindex),
                item.description,
                str(item.created.strftime("%b %d %Y %H:%M:%S"))
            ])
        return json_data


@login_required
def database(request):
    context = {
        'plasmidDatabaseContents': Plasmid.objects.all()
    }
    return render(request, 'database.html', context)

# --- Add Plasmid and Related Views --- #
import io

import dnassembly
from dnassembly import SequenceException

from .filters import PlasmidFilter

@login_required
def add_plasmids(request):
    context = dict()
    context['users'] = User.objects.all()
    return render(request, 'clone.html', context)


def assemblyPlasmidFilter(request):

    request_data = json.loads(request.POST['data'])
    draw_count = request_data['draw_count']
    print(draw_count)

    filter_data = request_data['filter_data']
    filter_expressions = dict()

    for filter_field in filter_data:
        if filter_data[filter_field] != '':
            if filter_field == 'description':
                filter_expressions[f'{filter_field}__icontains'] = filter_data[filter_field]
            elif filter_field == 'creatorindex':
                if filter_data[filter_field] not in ['', 0]:
                    filter_expressions[f'{filter_field}__exact'] = int(filter_data[filter_field])
            elif filter_field == 'creator':
                filter_expressions[f'{filter_field}__username__iexact'] = filter_data[filter_field]

    plasmid_filter = Plasmid.objects.filter(**filter_expressions)

    plasmid_filter_formatted = []
    for plasmid in plasmid_filter:
        row_content = [str(plasmid.creator), int(plasmid.creatorindex), str(plasmid.description)]
        plasmid_filter_formatted.append(row_content)

    json_data = {'data': plasmid_filter_formatted,
                 'draw': draw_count,
                 'recordsTotal': int(Plasmid.objects.all().count()),
                 'recordsFiltered': int(plasmid_filter.count()),
                 'success': True}

    return JsonResponse(json_data, status=200)


@login_required
def add_plasmid_by_file(request):
    """
    Add a file to the database from a genbank file
    """
    response_dict = {'success': False}

    if request.method == 'POST' and request.FILES['file']:
        uploaded_file = request.FILES['file']

        # Convert BytesIO into something BioPython can work with
        upload_stringio = io.StringIO(uploaded_file.file.getvalue().decode('UTF-8'))
        dnassembly_plasmid = dnassembly.read_genbank(upload_stringio, dnassembly.ReadAs.Plasmid)

        try:
            new_plasmid = Plasmid(sequence=dnassembly_plasmid.sequence,
                                  creator=request.user,
                                  description=dnassembly_plasmid.description)
            new_plasmid.save()
            response_dict['success'] = True
            current_creator = str(new_plasmid.creator)
            current_creator_index = int(new_plasmid.creatorindex)
            response_dict['plasmid_id'] = (current_creator, current_creator_index)
            response_dict['filename'] = str(uploaded_file.name)

        # Catch Exceptions
        except SequenceException as e:
            response_dict['error'] = e
        except Exception as e:
            response_dict['error'] = e

    return JsonResponse(response_dict, status=200)


# --- Plasmid Features and Related Views --- #

@login_required
def features(request):
    context = {}
    return render(request, 'features.html', context)

# --- User/Plasmid specific views --- #
@login_required
def user_plasmids(request, user_id):
    return HttpResponse(f'Plasmids for user {user_id}')

@login_required
def plasmid(request, user_id, plasmid_id):
    return HttpResponse(f'Page for plasmid {user_id, plasmid_id}')
