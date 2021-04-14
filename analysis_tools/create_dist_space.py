#generate 3 images : the map, the points (red; blue for barycenter), and the cost for all the points on the map

import sys, math

from PIL import Image
import json
lands = json.load(open('land_array.json'))['land_array']

def color_scale(val, min, max): #map to rgb blue low, red high
  #red : 256 -> 0
  max_val = 256*4
  tot = int((val-min)/(max-min)*max_val)
  color = [0]*3
  if tot > 256*3:
    color[0] = 255
    color[1] = 255-(tot-256*3)
  elif tot > 256*2:
    color[0] = tot-256*2
    color[1] = 255
  elif tot > 256:
    color[1] = 255
    color[2] = 255-(tot-256)
  else:
    color[1] = tot
    color[2] = 255 
  
  return tuple(color)


land_dat_file = open(sys.argv[1])

ncols = int(land_dat_file.readline().split()[1])
nrows = int(land_dat_file.readline().split()[1])
xllcorner = int(land_dat_file.readline().split()[1])
yllcorner = int(land_dat_file.readline().split()[1])
cellsize = float(land_dat_file.readline().split()[1])
NODATA_value = land_dat_file.readline().split()[1]

map_out = Image.new('RGB', (ncols, nrows), color=0)
points_out = Image.new('RGB', (ncols, nrows), color=0)
costs_out = Image.new('RGB', (ncols, nrows), color=0)

points = [[54, 105], [41,55], [41,105]]#, [200, 90],[201, 92], [100, 60], [160, 100], [340, 40]] #[[lat, lng],...]

def posToRef(pos): # lat[-90;90] lng[-180:180] to 180:360 * cellsize
  return [int(pos[1]/cellsize-xllcorner), int(pos[0]/cellsize-yllcorner)]

def refToPos(ref):
  return [(ref[1]+yllcorner)*cellsize, (ref[0]+xllcorner)*cellsize]


points_px = [ posToRef(point) for point in points ] #lng, lat

# calc cost for each points

#*Barycenter calculations
def toRad(v):
  return v*(math.pi/180)

#haversine function
def haversine(angle):
  return math.sin(angle/2)**2

#use haversine formula (great circle distance)
def greatCircleDistance(p1,p2):
  r = 6371009; #earth radius in meters
  lat1 = toRad(p1[0])
  lat2 = toRad(p2[0])
  lng1 = toRad(p1[1])
  lng2 = toRad(p2[1])
  return 2*r*math.asin(math.sqrt(haversine(lat2-lat1)+math.cos(lat1)*math.cos(lat2)*haversine(lng2-lng1)))

def distance(p1, p2):
  return greatCircleDistance(p1,p2); #distance in km

#? order x,y
#cost : lower sum of squared distance between coordinates is better (assumed barycenter) 
def bary_cost(pos, coordinate_list):
  total_cost = 0
  for coordinate in coordinate_list:
    total_cost += distance(pos, coordinate)**2
  return total_cost

costs = [0]*(ncols*nrows)
max_c = None
min_c = None
for i in range(len(costs)):
  x = i%ncols
  y = i//ncols
  c = bary_cost(refToPos([x,y]), points)
  if max_c is None or c > max_c:
    max_c = c
  if min_c is None or c < min_c:
    min_c = c
  costs[i] = c

print('max :', max_c, 'min :', min_c, max(costs))

# create map costs (color scale from red to blue)
costs = [ color_scale(c, min_c, max_c) for c in costs ]
for i in range(len(costs)):
  costs_out.putpixel((i%ncols,i//ncols), costs[i])

# create map img
x,y = 0,0
for line in land_dat_file:
    for v in line.split():
        if v == NODATA_value:
            map_out.putpixel((x,y), (0,0,0))
        else:
            map_out.putpixel((x,y), (255,255,255)) #int(float(v)/13e3*255)
        x+= 1
    x = 0
    y += 1


#* Barycenter calculation
from random import random
#barycenter trace
def generateNearPosition(parent, max_lat, max_lng):
  lat = parent[0]+max_lat*(random()*2-1)
  while lat > 90:
    lat -= 90
  
  while lat < -90:
    lat += 90

  lng = parent[1]+max_lng*(random()*2-1)
  while lng > 180:
    lng -= 180

  while lng < -180:
    lng += 180
  
  return [lat, lng] # inverted convention


def findBarycenter(coordinate_list):
  if len(coordinate_list) == 1:
    return coordinate_list[0]
  
  bary_trace = [] # list of list of all random positions at each iteration
  
  #TODO : Three constant to fine tune
  k = 50
  iterations = 50
  division = 1.2

  span_lat = 90
  span_lng = 180

  best_pos = [0, 0]
  best_cost = bary_cost(best_pos, coordinate_list)
  for i in range(iterations):
    #generate n random positions near the best point
    pop = []
    for j in range(k):
      pop.append(generateNearPosition(best_pos, span_lat, span_lng))
    for p in pop:
      c = bary_cost(p, coordinate_list)
      if best_cost > c :#lower is better
        best_cost = c
        best_pos = p

    #console.log('best_cost : ', best_cost, 'best_pos : ', best_pos)
    bary_trace.append(pop)

    span_lat/=division
    span_lng/=division
  
  return best_pos, bary_trace

def isInLand(pos, cellsize=1):
  ref = posToRef(pos)
  return lands[ref[0]][ref[1]] == 1

def findLandBarycenter(coordinate_list, barycenter):
  if len(coordinate_list) == 1:
    return coordinate_list[0]
  
  bary_trace = [] # list of list of all valid random positions at each iteration
  
  #TODO : Three constant to fine tune
  k = 50
  iterations = 50
  multiplier = 1.2
  retry = 5

  span_lat_max = 90
  span_lng_max = 180
  span_lat = span_lat_max/multiplier**iterations
  span_lng = span_lng_max/multiplier**iterations

  best_pos = barycenter
  best_cost = None
  for i in range(iterations):
    #generate n random positions near the best point
    pop = []
    for j in range(k):
      p = generateNearPosition(best_pos, span_lat, span_lng)
      r = 0
      while r<retry and not isInLand(p):
        p = generateNearPosition(best_pos, span_lat, span_lng)
        r+=1
      if r != retry:
        pop.append(p)
    for p in pop:
      c = bary_cost(p, coordinate_list)
      if best_cost is None or best_cost > c :#lower is better
        best_cost = c
        best_pos = p

    #console.log('best_cost : ', best_cost, 'best_pos : ', best_pos)
    bary_trace.append(pop)

    span_lat*=multiplier
    span_lng*=multiplier
  
  return best_pos, bary_trace # if best_cost is None, barycenter in lands not found

#trace barycenter evolution
barycenter, trace = findBarycenter(points)
i = 0
for b in trace:
  for b_ in b:
    costs_out.putpixel(posToRef(b_),(180,255-i*255//len(trace),0))
  i += 1

landbarycenter, trace_land = findLandBarycenter(points, barycenter)
i = 0
for bl in trace_land:
  for bl_ in bl:
    costs_out.putpixel(posToRef(bl_),(100,255-i*255//len(trace),80))
  i += 1


# add points to img
for point_px in points_px:
  points_out.putpixel(point_px, (255, 0, 0))
  costs_out.putpixel(point_px, (0, 0, 0))
  map_out.putpixel(point_px, (255, 0, 0))

#put barycenter
barycenter_point = posToRef(barycenter)
#costs_out.putpixel(barycenter_point,(255,0,255))
map_out.putpixel(barycenter_point,(0,0,255))
points_out.putpixel(barycenter_point,(0,0,255))

landbarycenter_point = posToRef(landbarycenter)
map_out.putpixel(landbarycenter_point,(0,255,0))
points_out.putpixel(landbarycenter_point,(0,255,0))

from datetime import datetime
run_id = int(datetime.timestamp(datetime.now()))
map_out.save(f'{run_id} map.png')
points_out.save(f'{run_id} points.png')
costs_out.save(f'{run_id} costs.png')