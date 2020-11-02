from django.db import models
from django.conf import settings

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Location(models.Model):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.TextField()
    description = models.TextField(null=True)
    subcategory = models.ForeignKey('Location', on_delete=models.CASCADE, null=True)

    @staticmethod
    def populate_dropdown():
        """Nested JSON of location hierarchy"""

        def populate_node(current_node):
            # Create dict for each root node
            node_dict = dict()
            node_dict['text'] = str(current_node.name)
            node_dict['data'] = {'id': int(current_node.id)}
            node_dict['id'] = f'Location-{current_node.id}'

            location_children = current_node.location_set.all()
            if location_children:
                location_children_list = list()
                for location_child in location_children:
                    location_children_list.append(populate_node(location_child))
                node_dict['children'] = location_children_list
                node_dict['icon'] = 'fas fa-layer-group fa-fw'
            else:
                node_dict['icon'] = 'fas fa-tag fa-fw'
            return node_dict

        location_list = list()
        root_nodes = Location.objects.filter(subcategory__isnull=True)
        for node in root_nodes:
            location_list.append(populate_node(node))
        return location_list

    def get_full_location(self):
        """Traverse tree up to root node to report full location"""
        location_list = []
        current_location = self
        while current_location.subcategory is not None:
            location_list.append(current_location.name)
            current_location = current_location.subcategory
        location_list.append(current_location.name)
        return '|'.join(reversed(location_list))


class Container(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    location = models.ForeignKey('Location', on_delete=models.PROTECT)
    name = models.TextField()
    description = models.TextField(null=True)
    rows = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    columns = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    @staticmethod
    def populate_containers(location_pk):
        """Nested JSON of containers for a location"""

        def populate_node(current_node):
            # Create dict for each root node
            node_dict = dict()
            node_dict['text'] = str(current_node.name)
            node_dict['data'] = {'id': int(current_node.id)}
            node_dict['id'] = f'Container-{current_node.id}'
            node_dict['icon'] = 'fas fa-archive fa-fw'
            return node_dict

        location_list = list()
        root_nodes = Container.objects.filter(location_id=location_pk)
        for node in root_nodes:
            location_list.append(populate_node(node))
        return location_list


class ContainerContent(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    container = models.ForeignKey(Container, on_delete=models.PROTECT)
    row = models.PositiveIntegerField()
    column = models.PositiveIntegerField()
    consumable = models.BooleanField(default=False)
    consumed = models.BooleanField(default=False)

    class Meta:
        unique_together = ('container', 'row', 'column',)

    def clean(self):
        if self.row > self.container.rows or self.row < 1:
            raise ValidationError(f'Row position must fit inside the container dimensions!\n\
            (Acceptable row positions: 1-{self.container.rows})')
        if self.column > self.container.columns or self.column < 1:
            raise ValidationError(f'Column position must fit inside the container dimensions!\n\
            (Acceptable column positions: 1-{self.container.columns})')
