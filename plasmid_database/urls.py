from . import views
from django.urls import path, include
from django.contrib.auth.decorators import login_required

app_name = 'plasmid_database'
urlpatterns = [path(r'', views.database, name='database'),
               path(r'update_table/', login_required(views.plasmidDatatable.as_view()), name='update_table'),
               ]

# --- Plasmid Features --- #
urlpatterns += [path(r'features/', views.features, name='plasmid-features'),
                ]

# --- Add plasmids --- #

urlpatterns += [path(r'add/', views.add_plasmids, name='add-plasmids'),
                path(r'add_plasmid_by_file/', views.add_plasmid_by_file, name='add-plasmid-by-file'),
                path(r'assembly_plasmid_filter/', views.assemblyPlasmidFilter, name='assemblyPlasmidFilter'),
                ]

# --- View Plasmids --- #
urlpatterns += [path(r'<user_id>/', views.user_plasmids, name='user-plasmids'),
                path(r'<user_id>/<int:plasmid_id>/', views.plasmid, name='plasmid-view'),
                ]