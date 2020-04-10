"""
Create a default admin account

Source:
https://realpython.com/deploying-a-django-app-and-postgresql-to-aws-elastic-beanstalk/#configure-eb-initialize-your-app
"""
from django.core.management.base import BaseCommand
from plasmid_database.models import User

class Command(BaseCommand):

    def handle(self, *args, **options):
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("Admin", "admin@admin.com", "plasmid")
