import * as msgpack from '@msgpack/msgpack';
import fs from 'node:fs';
const buf = fs.readFileSync(process.argv[2]);
const data = msgpack.decode(new Uint8Array(buf));
console.log('نسخة الملف:', data.v);
console.log('عدد الأهداف:', data.dataList.length);
data.dataList.forEach((t,i) => {
  const kf = t.matchingData.length;
  const pts = t.matchingData.reduce((n,k)=>n+k.maximaPoints.length+k.minimaPoints.length,0);
  console.log(`  [${i}] ${t.targetImage.width}×${t.targetImage.height} · ${kf} إطار مفتاحي · ${pts} نقطة تعرّف`);
});
