import sys

land_dat_file = open(sys.argv[1])

ncols = int(land_dat_file.readline().split()[1])
nrows = int(land_dat_file.readline().split()[1])
xllcorner = int(land_dat_file.readline().split()[1])
yllcorner = int(land_dat_file.readline().split()[1])
cellsize = float(land_dat_file.readline().split()[1])
NODATA_value = land_dat_file.readline().split()[1]

m = 0

for line in land_dat_file:
    sp = line.split()
    for v in sp:
        if float(v) > m:
            m = float(v)

input(f"max : {m}")