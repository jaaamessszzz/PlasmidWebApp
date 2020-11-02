# Generated by Django 3.0.7 on 2020-10-25 22:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('locations', '0001_initial'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='ContainerContents',
            new_name='ContainerContent',
        ),
        migrations.AddField(
            model_name='container',
            name='name',
            field=models.TextField(default='BOX'),
            preserve_default=False,
        ),
    ]