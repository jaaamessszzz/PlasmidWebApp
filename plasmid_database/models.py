from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser

from dnassembly import Plasmid as dnaPlasmid

# Create your models here.

class User(AbstractUser):
    initials = models.CharField(max_length=10, unique=True)


class Project(models.Model):
    project = models.TextField()
    initials = models.CharField(max_length=10, unique=True)
    description = models.TextField()


class Feature(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    sequence = models.TextField()
    name = models.TextField()
    description = models.TextField(default='Just another plasmid feature...')

    class Meta:
        unique_together = ('creator', 'sequence',)


class Attribute(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    subcategory = models.ForeignKey('Attribute', on_delete=models.CASCADE, null=True)


class Location(models.Model):
    name = models.TextField()
    subcategory = models.ForeignKey('Location', on_delete=models.CASCADE, null=True)


class Plasmid(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    projectindex = models.IntegerField()
    userid = models.TextField(null=True)
    sequence = models.TextField()
    description = models.TextField()
    created = models.DateTimeField(auto_now_add=True)
    feature = models.ManyToManyField(Feature)
    attribute = models.ManyToManyField(Attribute)
    location = models.ManyToManyField(Location)


    class Meta:
        unique_together = ('project', 'projectindex',)

    def get_standard_id(self):
        return f'{self.project.project}_{self.projectindex:0>5}'

    def get_attributes_as_string(self):
        return ', '.join([attr.name for attr in self.attribute.all()])

    def get_features_as_string(self):
        return ', '.join([feat.name for feat in self.feature.all()])

    def get_locations_as_string(self):
        return ', '.join([loc.name for loc in self.location.all()])

    def save(self, *args, **kwargs):
        last_plasmid = Plasmid.objects.filter(project=self.project).order_by('projectindex').last()
        if not last_plasmid or last_plasmid.projectindex is None:
            plasmid_index = 1
        else:
            plasmid_index = last_plasmid.projectindex + 1
        self.projectindex = plasmid_index

        models.Model.save(self, *args, **kwargs)
        return self.creator, self.projectindex

    def as_dnassembly(self):
        """
        Get plasmid as DNAssembly Plasmid object
        :return:
        """
        # todo: pull related features, convert to DNAssembly Features, and add to Plasmid
        return dnaPlasmid(sequence=self.sequence, entity_id=f'{self.creator}_{self.projectindex}', description=self.description)

