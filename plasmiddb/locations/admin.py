from django.contrib import admin
from .models import Location, Container, ContainerContent


admin.site.register(Location)
admin.site.register(Container)
admin.site.register(ContainerContent)
