from .models import Plasmid
import django_filters

class PlasmidFilter(django_filters.FilterSet):
    class Meta:
        model = Plasmid
        fields = {'creator': ['exact'],
                  'creatorindex': ['exact'],
                  'description': ['icontains']
                  }