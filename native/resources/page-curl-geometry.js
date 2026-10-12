// Use the bottom-left corner as the start of the fold, in the Hebrew book
// direction. A ten-degree cylinder axis lets the lower edge lift first.
export function curlGeometry(width, height, progress) {
  const angle = Math.PI / 18;
  const nx = Math.cos(angle), ny = -Math.sin(angle);
  const originDot = ny * height;
  const extent = nx * width - ny * height;
  const radius = width * .115;
  const fold = progress * (extent + Math.PI * radius);
  const rectangle = [[0,0],[width,0],[width,height],[0,height]];
  const position = ([x,y]) => nx*x + ny*y - originDot;
  function clip(poly, boundary, keepAbove) {
    const output = [];
    for (let i=0;i<poly.length;i++) {
      const a=poly[i], b=poly[(i+1)%poly.length];
      const sa=position(a)-boundary, sb=position(b)-boundary;
      const insideA=keepAbove ? sa>=0 : sa<=0, insideB=keepAbove ? sb>=0 : sb<=0;
      if (insideA) output.push(a);
      if (insideA!==insideB) {
        const t=sa/(sa-sb);
        output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
      }
    }
    return output;
  }
  function slice(low, high) { return clip(clip(rectangle,low,true),high,false); }
  function patch(low,high,m,b,shade=0) {
    const polygon=slice(low,high);
    if(polygon.length<3) return null;
    const k=m-1, offset=b-k*originDot;
    const matrix=[1+k*nx*nx,k*nx*ny,k*nx*ny,1+k*ny*ny,nx*offset,ny*offset];
    return {polygon,matrix,shade};
  }
  const flat=patch(fold,extent,1,0), front=[], reverse=[];
  const strips=48, step=Math.PI/strips;
  for(let i=0;i<strips;i++) {
    const a0=i*step,a1=(i+1)*step;
    const low=fold-radius*a1, high=fold-radius*a0;
    const mappedLow=fold-radius*Math.sin(a1), mappedHigh=fold-radius*Math.sin(a0);
    const m=(mappedHigh-mappedLow)/(high-low), b=mappedLow-m*low;
    const p=patch(low,high,m,b,Math.sin((a0+a1)/2));
    if(p) (i<strips/2 ? front : reverse).push(p);
  }
  return {flat,front,reverse:reverse.reverse(),back:patch(0,fold-Math.PI*radius,-1,2*fold-Math.PI*radius),
    shadow:{nx,ny,originY:height,low:fold-radius-18,high:fold+12}};
}
