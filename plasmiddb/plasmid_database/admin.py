from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

# Register your models here.
from .models import User, Plasmid, Feature, Attribute, Location


class PlasmidAdmin(admin.ModelAdmin):
    def save_model(self, request, obj, form, change):
        last_plasmid = Plasmid(creator=request.user).objects.all().order_by('creator_index').last()
        plasmid_index = 1 if not last_plasmid else last_plasmid.creator_index + 1
        obj.creator = request.user
        obj.creator_index = plasmid_index
        super().save_model(request, obj, form, change)


admin.site.register(User, UserAdmin)
admin.site.register(Plasmid, PlasmidAdmin)
admin.site.register(Feature)
admin.site.register(Attribute)
admin.site.register(Location)
