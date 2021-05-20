from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy

from django.contrib.contenttypes.fields import GenericRelation
from django.apps import apps

from dnassembly.dna import Plasmid as dnaPlasmid
from dnassembly.dna import Feature as dnaFeature

# Create your models here.

class User(AbstractUser):
    initials = models.CharField(max_length=10, unique=True)


class Project(models.Model):
    project = models.TextField(unique=True)
    initials = models.CharField(max_length=10, unique=True)
    description = models.TextField()
    members = models.ManyToManyField(User)

class Feature(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    sequence = models.TextField()
    name = models.TextField()
    type = models.ForeignKey('FeatureType', on_delete=models.CASCADE, null=True)
    description = models.TextField(default='Just another plasmid feature...')

    class Meta:
        unique_together = ('creator', 'sequence',)


class FeatureType(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.TextField(unique=True)
    color = models.TextField(null=True)
    description = models.TextField(null=True)


class Attribute(models.Model):
    creator = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True)
    subcategory = models.ForeignKey('Attribute', on_delete=models.CASCADE, null=True)

    @staticmethod
    def populate_dropdown():
        """Nested JSON of attribute hierarchy"""

        def populate_node(current_node):
            # Create dict for each root node
            node_dict = dict()
            node_dict['text'] = str(current_node.name)
            node_dict['data'] = {'id': int(current_node.id)}
            node_dict['id'] = f'Attribute-{current_node.id}'

            attribute_children = current_node.attribute_set.all()
            if attribute_children:
                attribute_children_list = list()
                for attribute_child in attribute_children:
                    attribute_children_list.append(populate_node(attribute_child))
                node_dict['children'] = attribute_children_list
                node_dict['icon'] = 'fas fa-layer-group fa-fw'
            else:
                node_dict['icon'] = 'fas fa-tag fa-fw'
            return node_dict

        attribute_list = list()
        root_nodes = Attribute.objects.filter(subcategory__isnull=True)
        for node in root_nodes:
            attribute_list.append(populate_node(node))
        return attribute_list


class Plasmid(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    projectindex = models.IntegerField()
    sequence = models.TextField()
    description = models.TextField()
    benchlingID = models.TextField(unique=True)
    created = models.DateTimeField(auto_now_add=True)
    feature = models.ManyToManyField(Feature)
    attribute = models.ManyToManyField(Attribute)
    location = GenericRelation('locations.ContainerContent', related_query_name='container_plasmid')

    DESIGNED = 'Designed'
    VERIFIED = 'Verified'
    ABANDONED = 'Abandoned'
    STATUS_CHOICES = [(DESIGNED, DESIGNED), (VERIFIED, VERIFIED), (ABANDONED, ABANDONED)]

    status = models.TextField(choices=STATUS_CHOICES, default=DESIGNED)

    class Meta:
        unique_together = ('project', 'projectindex',)

    def get_standard_id(self):
        return f'p{self.project.project.capitalize()}_{self.projectindex:0>5}'

    def get_aliases_as_string(self):
        return ', '.join(sorted([altname.alias for altname in self.aliases.all()]))

    def get_descriptions_as_string(self):
        return ', '.join(sorted([des for des in self.description]))

    def get_attributes_as_string(self):
        return ', '.join(sorted([attr.name for attr in self.attribute.all()]))

    def get_features_as_string(self):
        return ', '.join(sorted([feat.name for feat in self.feature.all()]))

    def get_locations_as_string(self):
        return ', '.join(set([f"{loc.container.location.get_full_location()} - {loc.container.name}" for loc in self.location.all()]))

    def get_resistance_as_string(self):
        """Return subset of features that are FeatureType resistance"""
        all_features = [feat.name for feat in self.feature.all()]
        return ', '.join(sorted([feat.name for feat in self.feature.all() if feat.type is not None and feat.type.name == 'Resistance Marker']))

    def get_assembly_plasmids_as_string(self):
        """Get consituent plasmids"""
        return ', '.join([plasmid.input.get_standard_id() for plasmid in self.plasmidproduct.filter(product__id=self.id)])

    def save(self, *args, **kwargs):
        if not self.pk and not self.projectindex:
            last_plasmid = Plasmid.objects.filter(project=self.project).order_by('projectindex').last()
            if not last_plasmid or last_plasmid.projectindex is None:
                plasmid_index = 1
            else:
                plasmid_index = last_plasmid.projectindex + 1
            self.projectindex = plasmid_index

        super().save(*args, **kwargs)
        return self.creator, self.projectindex

    def as_dnassembly(self):
        """
        Get plasmid as DNAssembly Plasmid object
        :return:
        """
        # todo: pull related features, convert to DNAssembly Features, and add to Plasmid
        feature_list = list()
        for feature in self.feature.all():
            feature_list.append(dnaFeature(name=feature.name, sequence=feature.sequence, feature_type="Feature", strand=1))
        plasmid_dna_entity = dnaPlasmid(sequence=self.sequence, entity_id=self.get_standard_id(), name=self.get_standard_id(), description=self.description, features=feature_list)
        return plasmid_dna_entity


class PlasmidAlias(models.Model):
    alias = models.TextField(max_length=20)
    plasmid = models.ForeignKey(Plasmid, on_delete=models.CASCADE, related_name='aliases')


class PlasmidAssembly(models.Model):
    product = models.ForeignKey(Plasmid, on_delete=models.CASCADE, related_name='plasmidproduct')
    input = models.ForeignKey(Plasmid, on_delete=models.CASCADE, related_name='plasmidinput')

    class Meta:
        unique_together = ('product', 'input',)


class PlasmidFile(models.Model):
    file = models.FileField()
    filename = models.TextField()
    plasmid = models.ForeignKey(Plasmid, on_delete=models.CASCADE, related_name='files')
    description = models.TextField()
    creator = models.ForeignKey(User, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)


# --- Plasmid Part Assembly Views --- #

class PlasmidPartPrimer(models.Model):
    sequence = models.TextField()

    def get_name(self):
        return f'o{self.pk:0>5}'


class PlasmidPartFragment(models.Model):
    plasmid = models.ForeignKey(Plasmid, on_delete=models.CASCADE, related_name='fragments')
    index = models.IntegerField()
    sequence = models.TextField()
    method = models.TextField()
    primers = models.ManyToManyField(PlasmidPartPrimer)
    template = models.TextField()
