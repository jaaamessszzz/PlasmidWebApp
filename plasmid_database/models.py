from django.db import models
from django.db.models import F
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser


# Create your models here.

class User(AbstractUser):
    initials = models.CharField(max_length=10)


class Plasmid(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    creatorindex = models.IntegerField(null=True)
    # userid = models.TextField(null=True)
    sequence = models.TextField()
    description = models.TextField()
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('creator', 'creatorindex',)

    def save(self, *args, **kwargs):
        last_plasmid = Plasmid.objects.filter(creator=self.creator).order_by('creatorindex').last()
        if not last_plasmid or last_plasmid.creatorindex is None:
            plasmid_index = 1
        else:
            plasmid_index = last_plasmid.creatorindex + 1
        self.creatorindex = plasmid_index

        # if self.userid is None:
        #     self.userid = f'p{self.creator.first_name[0]}{self.creator.last_name[0]}{self.creatorindex:0>5}'
        models.Model.save(self, *args, **kwargs)
        return self.creator, self.creatorindex


class Feature(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    sequence = models.TextField()
    description = models.TextField()
    plasmid = models.ManyToManyField(Plasmid)

    class Meta:
        unique_together = ('creator', 'sequence',)


class Attribute(models.Model):
    attribute = models.CharField(max_length=40)
    description = models.TextField()
    plasmid = models.ManyToManyField(Plasmid)


class Location(models.Model):
    location = models.TextField()
    plasmid = models.ForeignKey('Plasmid', on_delete=models.CASCADE)


class Project(models.Model):
    project = models.TextField()
    member = models.ManyToManyField(settings.AUTH_USER_MODEL)
    description = models.TextField()
