from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.validators import ValidationError

from .models import User, Project, PlasmidFile

class SignUpForm(UserCreationForm):
    first_name = forms.CharField(max_length=255)
    last_name = forms.CharField(max_length=255)
    email = forms.EmailField(max_length=255)
    initials = forms.CharField(max_length=10, help_text='Unique initial - shorthand to identify your database entries')

    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'initials', 'password1', 'password2',)

    def clean_email(self):
        email = self.cleaned_data['email']
        if User.objects.filter(email=email).exists():
            raise ValidationError("Email already exists!")
        return email

    def clean_username(self):
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists() or Project.objects.filter(project=username).exists():
            raise ValidationError("Username already exists!")
        return username

    def clean_initials(self):
        initials = self.cleaned_data['initials']
        if Project.objects.filter(initials=initials).exists():
            raise ValidationError("Initials already exist!")
        return initials


class PlasmidFileForm(forms.ModelForm):
    class Meta:
        model = PlasmidFile
        fields = ('file', 'description')
