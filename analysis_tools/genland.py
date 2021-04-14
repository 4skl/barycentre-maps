import sys, os
from PIL import Image
import json

filename = sys.argv[1]

def landArrayToBinFile(land_array, file):
    b = 0 #bit index
    i = 0
    for line in land_array:
        for v in line:
            if i%8 == 7:
                b |= v
                file.write(bytes([b]))
                b = 0
            else:
                b |= v
                b <<= 1
            i+=1
    if i%8 != 0:
        file.write(bytes([b]))
    file.flush()


def landArrayToBinFileTest(land_array, file):
    b = 0 #bit index
    i = 0
    img_test = Image.new('L', (ncols, nrows), color=0)
    land_count = 0
    output = bytearray(b'')
    for line in land_array:
        for v in line:
            if i%8 == 7:
                b |= v
                file.write(bytes([b]))
                output.append(b)
                b = 0
            else:
                b |= v
                b <<= 1
            i+=1
    if i%8 != 0:
        file.write(bytes([b]))
    file.flush()

    size = i#len(land_array) * len(land_array[0])
    for x in range(len(land_array)):
        for y in range(len(land_array[x])):
            point_index = y*len(land_array)+x   
            point_index_byte = int(point_index/8)
            b = output[point_index_byte] # byte containing 8 points
            point = (b>>int(point_index%8)) & 1
            img_test.putpixel((x,y), 255 if point == 1 else 0)

            #assert land_array[x][y] == output[point_index_byte], f'{land_array[x][y] == output[point_index_byte]} not same val : {land_array[x][y]} : {output[point_index_byte]} b {b} point_index {point_index}'

    return img, output, land_count

def readLandFile(land_file):
    ncols = int(land_file.readline().split()[1])
    nrows = int(land_file.readline().split()[1])
    xllcorner = float(land_file.readline().split()[1])
    yllcorner = float(land_file.readline().split()[1])
    cellsize = float(land_file.readline().split()[1])
    NODATA_value = land_file.readline().split()[1]

    land_array = [[0]*nrows for i in range(ncols)] # sparse matrix instead ?

    img = Image.new('L', (ncols, nrows), color=0)
    land_count = 0
    x,y = 0,0
    for line in land_file:
        for v in line.split():
            if v == NODATA_value:
                img.putpixel((x,y), 0)
                land_array[x][y] = 0
            else:
                land_count += 1
                img.putpixel((x,y), 255) #int(float(v)/13e3*255)
                land_array[x][y] = 1
            x+= 1
        x = 0
        y += 1
    return img, land_array, ncols, nrows

if os.path.isdir(filename):
    i = 0
    for sub_file in os.listdir(filename):
        img, land_array, ncols, nrows = readLandFile(open(sub_file))
        img.save(f'map {i} {ncols}x{nrows}.png')
        json.dump({'land_array': land_array}, open(f'land_array {i} {ncols}x{nrows}.json', 'w'))
        landArrayToBinFile(land_array, open(f'map {i} {ncols}x{nrows}.bin'))
        i+=1
    
else:
    img, land_array, ncols, nrows = readLandFile(open(filename))
    img.save(f'img{ncols}x{nrows}.png')
    json.dump({'land_array': land_array}, open(f'land_array {ncols}x{nrows}.json', 'w'))
    landArrayToBinFile(land_array, open(f'map {ncols}x{nrows}.bin', 'wb'))

    #test
    img, output, land_count = landArrayToBinFileTest(land_array,open(f'map test {ncols}x{nrows}.bin', 'wb'))
    

    img.save(f'test{ncols}x{nrows}land_c{land_count}.png')