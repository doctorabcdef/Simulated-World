export function intersects(x,z,y,box,r=.24){return y<box.maxY&&y+1.65>box.minY&&x+r>box.minX&&x-r<box.maxX&&z+r>box.minZ&&z-r<box.maxZ;}
export function floorAt(x,z,y){
  // Exterior stair on the right: from the courtyard (z=11.15) up to the balcony (z=3.15).
  if(x>7.5&&x<9.3&&z>=3.15&&z<=11.15)return Math.max(0,Math.min(3.3,(11.15-z)/8*3.3));
  if(y>2.9&&z>-5.85&&z<3.15&&x>-7.3&&x<9.35)return 3.3;
  return 0;
}
