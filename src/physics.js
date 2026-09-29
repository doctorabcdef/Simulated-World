export function intersects(x,z,y,box,r=.24){return y<box.maxY&&y+1.65>box.minY&&x+r>box.minX&&x-r<box.maxX&&z+r>box.minZ&&z-r<box.maxZ;}
export function floorAt(x,z,y){
  // Exterior stair on the right: from the courtyard (z=8) up to the balcony (z=0).
  if(x>7.5&&x<9.3&&z>=0&&z<=8)return Math.max(0,Math.min(3.3,(8-z)/8*3.3));
  if(x>-7.35&&x<9.35&&z>-5.7&&z<2.5&&y>2.9)return 3.3;
  return 0;
}
