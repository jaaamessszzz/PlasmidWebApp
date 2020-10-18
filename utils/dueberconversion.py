"""
Import plasmids from the Dueber lab database into the new schema.

Usage:
    dueberconversion <sqldb> <username> [--project=<project>]

Arguments:
    <sqldb>         Name of MySQL database containing DueberLab plasmids
    <username>      User to submit new entries

Options:
    --project=<project>     Name of project to add plasmids to (defaults to user project)
"""

import os
import sys

import django
from docopt import docopt
import pymysql.cursors

from dnassembly.utils.annotation import annotate_moclo

# https://www.workaround.cz/howto-access-django-orm-model-external-python-script/
PROJECT_ROOT = os.path.abspath(os.path.join(__file__, '..', '..'))  # lmao
sys.path.append(str(PROJECT_ROOT))

os.environ["DJANGO_SETTINGS_MODULE"] = 'plasmiddb.settings'
django.setup()

from plasmid_database.models import User, Plasmid, PlasmidAlias, Project, Attribute

def transfer_plasmids(user, project):
    """Transfer plasmids from Dueber lab MySQL Database to PostgreSQL Schema"""

    connection = pymysql.connect(host='localhost',
                                 user='root',
                                 password='root',
                                 db='plasmids',
                                 charset='utf8mb4',
                                 cursorclass=pymysql.cursors.DictCursor)

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM Plasmids")

            for plasmid in cursor:
                new_plasmid = Plasmid(creator=user, project=project, sequence=plasmid['Sequence'],
                                      description=' | '.join([plasmid['Description'], plasmid['Notes']]))
                new_plasmid.save()

                new_alias = PlasmidAlias(alias=plasmid['Name'], plasmid=new_plasmid)
                new_alias.save()

                # Annotate part plasmid, if applicable
                print(f"Annotating {plasmid['Name']}/{new_plasmid.get_standard_id()}...")

                moclo_parts = annotate_moclo(new_plasmid.sequence)
                if moclo_parts:
                    attribute_list = list()
                    for part in moclo_parts:
                        current_attribute = Attribute.objects.filter(name=f'Part {part}')
                        for attr in current_attribute:
                            attribute_list.append(attr)
                    new_plasmid.attribute.add(*attribute_list)

                # Annotate cassette plasmid, if applicable
                moclo_cassette = annotate_moclo(new_plasmid.sequence, annotate='cassette')
                if moclo_cassette:
                    attribute_list = list()
                    for cassette in moclo_cassette:
                        current_attribute = Attribute.objects.filter(name=f'Con {cassette}')
                        for attr in current_attribute:
                            attribute_list.append(attr)
                    new_plasmid.attribute.add(*attribute_list)

    finally:
        connection.close()

if __name__ == '__main__':
    args = docopt(__doc__)

    # Make sure user in already in database
    current_user = User.objects.get(username=args['<username>'])
    current_project = Project.objects.get(project=current_user.username)

    # Do work
    transfer_plasmids(current_user, current_project)
