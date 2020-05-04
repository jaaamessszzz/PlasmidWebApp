"""
Creates initial commits to the plasmid database for MoClo features
    * Add MoClo Attribute tree
    * Populate FeatureType and Feature tables
"""
from django.core.management.base import BaseCommand, CommandError
from dnassembly.reactions.moclo import PartOrder, CassetteOrder
from plasmid_database.models import User, Attribute, FeatureType

class Command(BaseCommand):

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('user', nargs=1, type=str)

    def handle(self, *args, **options):
        username = options['user']
        user = User.objects.get(username='Admin')  # Meh

        self.add_moclo_attributes(user)
        self.add_default_features(user)

    def add_moclo_attributes(self, user):
        """Adds Modular Cloning Attributes to database"""

        # Check for existing modular cloning tree
        if len(Attribute.objects.filter(name='Modular Cloning')) > 0:
            print('It looks like Modular Cloning Attributes have already been added to the database!')
            return

        modular_cloning = Attribute(name='Modular Cloning', description='Modular Cloning designations.', creator=user, subcategory=None)
        modular_cloning.save()

        part_entry_vector = Attribute(name='Part Entry Vector',
                                      description='Specifies plasmids that can accept parts in part assembly.',
                                      creator=user, subcategory=modular_cloning)
        part_entry_vector.save()

        multicassette = Attribute(name='Multicassette',
                                      description='A plasmid assembled from one or more cassettes.',
                                      creator=user, subcategory=modular_cloning)
        multicassette.save()

        cassette = Attribute(name='Cassette',
                             description='A plasmid assembled from one or more parts.',
                             creator=user, subcategory=modular_cloning)
        cassette.save()

        for type in CassetteOrder.bsmbi_annotation_f.values():
           connectors = type.split('-')
           cassette_type = Attribute(name=f'Con {type}',
                                description=f'A Cassette bounded by 5\' Con{connectors[0]} and 3\' Con{connectors[1]}',
                                creator=user, subcategory=cassette)
           cassette_type.save()

        part = Attribute(name='Part',
                     description='A plasmid containing a single functional DNA segment.',
                     creator=user, subcategory=modular_cloning)
        part.save()

        for type in PartOrder.bsai_annotation_f.values():
           part_type = Attribute(name=f'Part {type}',
                                description=f'A part plasmid with type {type} overhangs.',
                                creator=user, subcategory=part)
           part_type.save()


    def add_default_features(self, user):
        """Adds default features for parts"""
        feature_types = ['Part', 'Open Reading Frame', 'Promoter', 'Ribosome Binding Site', 'Terminator',
                         'Origin of Replication', 'Resistance Marker']
        for type in feature_types:
<<<<<<< HEAD
            if len(FeatureType.objects.filter(name=type)) == 0:
                featuretype = FeatureType(name=type, creator=user)
                featuretype.save()
=======
            featuretype = FeatureType(name=type, creator=user)
            featuretype.save()
>>>>>>> e4fe7fe284de12d678e850ea0097cfb7ea1d42e1
