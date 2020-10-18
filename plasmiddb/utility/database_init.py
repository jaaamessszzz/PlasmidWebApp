"""
Creates initial commits to the plasmid database for MoClo features
    * Add MoClo Attribute tree
    * Populate FeatureType and Feature tables

Usage:
    database_init <username>

Arguments:
    <username>      User to submit new entries

"""

import os
import sys

import django
from docopt import docopt

from dnassembly.reactions.moclo import PartOrder, CassetteOrder

# https://www.workaround.cz/howto-access-django-orm-model-external-python-script/
PROJECT_ROOT = os.path.abspath(os.path.join(__file__, '..', '..'))  # lmao
sys.path.append(str(PROJECT_ROOT))

os.environ["DJANGO_SETTINGS_MODULE"] = 'plasmiddb.settings'
django.setup()

from plasmid_database.models import User, Attribute, FeatureType


def add_moclo_attributes(user):
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


def add_default_features(user):
    """Adds default features for parts"""
    feature_types = ['Part', 'Open Reading Frame', 'Promoter', 'Ribosome Binding Site', 'Terminator',
                     'Origin of Replication', 'Resistance Marker']
    for type in feature_types:
        featuretype = FeatureType(name=type, creator=user)
        featuretype.save()


if __name__ == '__main__':
    args = docopt(__doc__)

    # Make sure user in already in database
    current_user = User.objects.get(username=args['<username>'])

    # Do work
    add_moclo_attributes(current_user)
    add_default_features(current_user)
