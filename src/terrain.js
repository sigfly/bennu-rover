export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export const radians = d=>d*Math.PI/180;
export function geoToVector(lat,lon){const p=radians(lat),l=radians(lon);return [Math.cos(p)*Math.cos(l),Math.sin(p),-Math.cos(p)*Math.sin(l)];}
export function vectorToGeo(v){const r=Math.hypot(v.x,v.y,v.z);return {lat:Math.asin(clamp(v.y/r,-1,1))*180/Math.PI,lon:((Math.atan2(-v.z,v.x)*180/Math.PI+540)%360)-180};}
