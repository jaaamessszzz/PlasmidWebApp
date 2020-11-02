import re
import json

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse, Http404
from django.utils.html import escape
from django.apps import apps

from django_datatables_view.base_datatable_view import BaseDatatableView

from .models import *


@login_required
def location_browser(request):
    context = {
        'users': apps.get_model('plasmid_database', 'User').objects.all(),
        'projects': apps.get_model('plasmid_database', 'Project').objects.all(),
    }
    print(context)
    return render(request, 'locations/browser.html', context=context)


@login_required
def location_checkout(request):
    context = dict()

    return render(request, 'locations/checkout.html', context=context)


@login_required
def location_manager(request):
    context = dict()
    context['current_user'] = request.user
    context['users'] = apps.get_model('plasmid_database', 'User').objects.all()
    context['projects'] = apps.get_model('plasmid_database', 'Project').objects.all()
    return render(request, 'locations/manage.html', context=context)

# --- Location Browser --- #

@login_required
def get_location_containers(request):
    """Get containers for the specified location"""
    location_id = int(request.POST['loc_id'])
    location_containers = Container.populate_containers(location_id)
    return JsonResponse({'data': location_containers})


@login_required
def get_container_contents(request):
    """Get contents for the specified container"""
    container_id = int(request.POST['container_id'])
    container_contents = ContainerContent.objects.filter(container_id__exact=container_id)
    container = Container.objects.get(id=container_id)
    location_path = container.location.get_full_location()
    container_contents_dict = {}

    # Build dict with row > column for easy table population
    for content in container_contents:
        if content.row not in container_contents_dict.keys():
            container_contents_dict[content.row] = {}
        # This assumes all content (row, column) are unique, enforced by DB
        container_contents_dict[content.row][content.column] = {'name': content.content_object.get_standard_id(),
                                                                'description': content.content_object.description,
                                                                'type': str(content.content_object.__class__.__name__),
                                                                'id': content.content_object.id,
                                                                }
    return JsonResponse({'contents': container_contents_dict,
                         'rows': container.rows,
                         'columns': container.columns,
                         'location': location_path,
                         'container': container.name,
                         })


@login_required
def add_reagents_to_container(request):
    """Add reagents to container"""
    reagent_id = int(request.POST['reagent_id'])
    container_id = int(request.POST['container_id'])
    positions = request.POST['positions']
    positions = json.loads(positions)
    print(positions)
    reagent_model = apps.get_model('plasmid_database', 'Plasmid')
    new_reagent = reagent_model.objects.get(id=reagent_id)
    current_container = Container.objects.get(id=container_id)

    for position in positions:
        row = int(position[0])
        column = int(position[1])
        position_query = ContainerContent.objects.filter(row__exact=row,
                                                         column__exact=column,
                                                         container=current_container,
                                                         )
        if not position_query:
            new_reagent_position = ContainerContent(content_object=new_reagent,
                                                    container=current_container,
                                                    row=row,
                                                    column=column,
                                                    )
            new_reagent_position.save()
    return JsonResponse({'success': True})


@login_required
def remove_reagents_from_container(request):
    """Remove reagents from container"""
    container_id = int(request.POST['container_id'])
    positions = request.POST['positions']
    positions = json.loads(positions)
    current_container = Container.objects.get(id=container_id)

    for position in positions:
        row = int(position[0])
        column = int(position[1])
        print(row, column)
        position_query = ContainerContent.objects.filter(row__exact=row,
                                                         column__exact=column,
                                                         container=current_container,
                                                         )
        print(position_query)
        position_query.delete()
    return JsonResponse({'success': True})


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


@login_required
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

# --- Container Dropdown Views --- #

@login_required
def get_container_info(request):
    """Return container information"""
    container_id = int(request.POST['container_id'])
    requested_container = Container.objects.get(id=container_id)
    container_dict = dict()
    container_dict['Owner'] = str(requested_container.owner.username)
    container_dict['CreatorID'] = int(requested_container.owner.id)
    container_dict['Description'] = str(requested_container.description) if requested_container.description != '' else 'None.'
    container_dict['Name'] = str(requested_container.name)
    container_dict['Contents'] = len(requested_container.containercontent_set.all())
    return JsonResponse(container_dict)


@login_required
def add_container_to_database(request):
    """Add a container to the database"""
    new_container_name = request.POST['container_name']
    new_container_description = request.POST['container_description']
    new_container_rows = request.POST['container_rows']
    new_container_cols = request.POST['container_columns']
    new_container_location = request.POST['parent_node']
    exisiting_root_node_names = [str(loc.name).lower() for loc in Container.objects.all()]
    if new_container_name.lower() not in exisiting_root_node_names:
        new_container = Container(name=new_container_name, description=new_container_description, owner=request.user,
                                  rows=new_container_rows, columns=new_container_cols, location_id=new_container_location)
        new_container.save()
        return JsonResponse({'success': True, 'Error': None})
    else:
        return JsonResponse({'success': False, 'Error': 'There was an error with your submission!'})


@login_required
def modify_container(request):
    user_id = int(request.user.id)
    requested_container = int(request.POST['container_id'])
    container_to_modify = Container.objects.get(id=requested_container)
    modification = request.POST['modification']
    response_dict = dict()

    if container_to_modify.owner.id != user_id:
        response_dict['Success'] = False
        response_dict['Error'] = f'You can only {modification} your own containers!'
    else:
        try:
            if modification == 'edit':
                container_to_modify.name = request.POST['new_name']
                container_to_modify.description = request.POST['new_description']
                container_to_modify.save()
            elif modification == 'delete':
                container_to_modify.delete()
            response_dict['Success'] = True
        except Exception as e:
            response_dict['Success'] = False
            response_dict['Error'] = str(e)
    return JsonResponse(response_dict)

