# Generated by Django 3.0.7 on 2021-05-26 03:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plasmid_database', '0010_auto_20210521_0331'),
    ]

    operations = [
        migrations.AlterField(
            model_name='plasmidpartfragment',
            name='template',
            field=models.TextField(null=True),
        ),
    ]