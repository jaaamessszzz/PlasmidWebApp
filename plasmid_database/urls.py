from . import views
from django.urls import path, include
from django.contrib.auth.decorators import login_required

app_name = 'plasmid_database'
urlpatterns = [path('signup/', views.new_user, name='new-user'),
               path(r'', views.database, name='database'),
               path(r'download_database_plasmids/', views.download_selected_plasmids, name='download-database-plasmids'),
               path(r'get_assembly_instructions/', views.get_assembly_instructions, name='get-assembly-instructions'),
               path(r'update_status/', views.update_status, name='update-plasmid-status'),
               path(r'delete_user_plasmids/', views.delete_user_plasmids, name='delete-user-plasmids'),
               path(r'update_table/', login_required(views.PlasmidDatatable.as_view()), name='update_table'),
               ]

# --- Project Management --- #
urlpatterns += [path(r'manage/', views.manage_database, name='plasmid-management'),
                path(r'update_feature_table/', login_required(views.FeatureDatatable.as_view()), name='update-feature-table'),
                path(r'update_feature/', views.update_feature, name='update-feature'),
                ]

# --- Add plasmids --- #
urlpatterns += [path(r'add/', views.add_plasmids, name='add-plasmids'),
                path(r'update_filter_table/', login_required(views.PlasmidFilterDatatable.as_view()), name='update-filter-table'),
                path(r'add_plasmid_by_file/', views.add_plasmid_by_file, name='add-plasmid-by-file'),
                path(r'standard_assembly/', views.standard_assembly, name='standard-assembly'),
                path(r'part_assembly/', views.part_assembly, name='part-assembly'),
                path(r'assembly_results/', views.assembly_result, name='assembly-results'),
                # path(r'perform_assemblies/', views.perform_assemblies, name='perform-assemblies'),
                ]

# --- Populate Attribute Dropdowns --- #
urlpatterns += [path(r'get_attribute_tree/', views.get_attribute_tree, name='attr-tree'),
                path(r'get_attribute_info/', views.get_attribute_info, name='attr-info'),
                path(r'add_attribute_to_db/', views.add_attribute_to_database, name='attr-add-to-db'),
                path(r'modify_attribute/', views.modify_attribute, name='attr-modify'),
                path(r'get_attribute_children/', views.get_attribute_children, name='attr-children'),
                ]

# --- Populate Location Dropdowns --- #
urlpatterns += [path(r'get_location_tree/', views.get_location_tree, name='loc-tree'),
                path(r'get_location_info/', views.get_location_info, name='loc-info'),
                path(r'add_location_to_db/', views.add_location_to_database, name='loc-add-to-db'),
                path(r'modify_location/', views.modify_location, name='loc-modify'),
                ]

# --- View Plasmids --- #
urlpatterns += [path(r'<project_id>/<int:plasmid_id>/', views.plasmid, name='plasmid-view'),
                path(r'update_plasmid/', views.update_plasmid, name='update-plasmid'),
                path(r'update_alias/', views.update_alias, name='update-alias'),
                ]
