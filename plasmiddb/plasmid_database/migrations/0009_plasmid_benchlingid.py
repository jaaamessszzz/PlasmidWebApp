# Generated by Django 3.0.7 on 2021-05-21 02:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plasmid_database', '0008_remove_plasmidpartprimer_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='plasmid',
            name='benchlingID',
            field=models.TextField(null=True, unique=True),
        ),
    ]
