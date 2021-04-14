from django.shortcuts import render

def index(request):
  return render(request, 'index.html')

def info(request):
  return render(request, 'info.html')

def test(request):
  return render(request,'test.html')