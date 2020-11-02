from . import views
from django.urls import path, include
from django.contrib.auth.decorators import login_required

app_name = 'locations'
urlpatterns = [path(r'', views.location_browser, name='location-browse'),
               path(r'checkout/', views.location_checkout, name='location-checkout'),
               path(r'manage/', views.location_manager, name='location-management'),
               ]

# --- Location/Container Centric Views --- #

urlpatterns += [path(r'get_location_containers/', views.get_location_containers, name='get-location-containers'),
                path(r'get_container_contents/', views.get_container_contents, name='get-container-contents'),
                path(r'add_reagents_to_container/', views.add_reagents_to_container, name='add-reagents-to-container'),
                path(r'remove_reagents/', views.remove_reagents_from_container, name='remove-reagents-from-container'),
                ]

# --- Populate Location Dropdowns --- #
urlpatterns += [path(r'get_location_tree/', views.get_location_tree, name='loc-tree'),
                path(r'get_location_info/', views.get_location_info, name='loc-info'),
                path(r'add_location_to_db/', views.add_location_to_database, name='loc-add-to-db'),
                path(r'modify_location/', views.modify_location, name='loc-modify'),
                ]

# --- Populate Container Dropdowns --- #
urlpatterns += [path(r'get_container_info/', views.get_container_info, name='container-info'),
                path(r'add_container_to_db/', views.add_container_to_database, name='container-add-to-db'),
                path(r'modify_container/', views.modify_container, name='container-modify'),
                ]