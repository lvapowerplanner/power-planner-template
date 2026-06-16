import type { DistroDefinition, PlannerOutput } from "./types";

function outs(prefix: string, count: number, phases: PlannerOutput['phase'][], type = '16A', rating = 16): PlannerOutput[] {
  const arr: PlannerOutput[] = [];
  for (let i = 1; i <= count; i += 1) {
    arr.push({
      id: prefix + i,
      label: prefix + ' ' + i,
      phase: phases[(i - 1) % phases.length],
      type,
      rating,
      items: [],
    });
  }
  return arr;
}
function out(
  num: number,
  phase: PlannerOutput['phase'],
  amps: number,
  threePhase = false
): PlannerOutput {
  const type = amps + 'A / ' + (threePhase ? '3' : '1');
  return {
    id: 'out' + num,
    label: String(num),
    phase: threePhase ? '3Φ' : phase,
    type,
    rating: amps,
    items: [],
  };
}
function socaOut(num: number, breakerPair: string | null = null): PlannerOutput {
  const circuits: PlannerOutput[] = [];
  ([['L1', [1, 4]], ['L2', [2, 5]], ['L3', [3, 6]]] as const).forEach(([ph, nums]) => {
    nums.forEach((n) => {
      circuits.push({
        id: 'soca' + num + '-' + ph + '-' + n,
        label: num + ' - ' + n,
        phase: ph,
        circuitNo: n,
        type: '16A / 1',
        rating: 16,
        items: [],
      });
    });
  });

  return {
    id: 'soca' + num,
    outputNumber: num,
    label: 'Socapex ' + num,
    phase: 'Socapex',
    type: 'Socapex',
    rating: 32,
    items: [],
    breakerPair,
    socaCircuits: circuits,
    detail: '2 × 16A sockets per phase · L1 1 & 4 · L2 2 & 5 · L3 3 & 6',
  };
}
export const distroLibrary: DistroDefinition[] = [
{name:'125 / 3 Type 1',input:'125A / 3',inputA:125,outputs:[Object.assign(out(1,'3Φ',32,true),{label:'1 32/3',displayName:'Output 1 – 32/3'}),Object.assign(out(2,'3Φ',32,true),{label:'2 32/3',displayName:'Output 2 – 32/3'}),Object.assign(out(3,'3Φ',32,true),{label:'3 32/3',displayName:'Output 3 – 32/3'}),Object.assign(out(4,'3Φ',63,true),{label:'4 63/3',displayName:'Output 4 – 63/3'}),Object.assign(out(5,'3Φ',63,true),{label:'5 63/3',displayName:'Output 5 – 63/3'}),Object.assign(out(6,'3Φ',63,true),{label:'6 63/3',displayName:'Output 6 – 63/3'}),Object.assign(out(7,'3Φ',125,true),{label:'7 125/3',displayName:'Output 7 – 125/3'})]},
{name:'32 / 1 Type A',input:'32A / 1',inputA:32,outputs:[out(1,'L1',16),out(2,'L1',16),out(3,'L1',16),out(4,'L1',16)]},
{name:'32 / 3 Type 1',input:'32A / 3',inputA:32,outputs:[...outs('16A',6,['L1','L2','L3'],'16A / 1',16),...outs('32A',3,['L1','L2','L3'],'32A / 1',32)]},
{name:'32 / 3 Type 5',input:'32A / 3',inputA:32,outputs:[out(1,'L1',32),out(2,'L2',32),out(3,'L3',32),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),out(7,'L1',16),out(8,'L2',16),out(9,'L3',16)]},
{name:'32 / 3 12 Way Soca Distro',input:'32A / 3',inputA:32,outputs:[socaOut(1),socaOut(2),Object.assign(out(3,'L1',16),{label:'Aux',displayName:'Aux'})]},
{name:'63 / 3 24 Way Soca Distro',input:'63A / 3',inputA:63,outputs:[socaOut(1),socaOut(2),socaOut(3),socaOut(4)]},
{name:'63/3 24 Way Event Distro',input:'63A / 3',inputA:63,outputs:[socaOut(1,'1&2'),socaOut(2,'1&2'),socaOut(3,'3&4'),socaOut(4,'3&4'),socaOut(5,'5&6'),socaOut(6,'5&6'),socaOut(7,'7&8'),socaOut(8,'7&8'),out(1,'L1',16),out(2,'L2',16),out(3,'L3',16),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),out(7,'L1',32),out(8,'L2',32),out(9,'L3',32),out(10,'3Φ',32,true),out(11,'3Φ',63,true)]},
{name:'32 / 3 Sleeve Distro (Audio)',input:'32A / 3',inputA:32,outputs:[out(1,'L1',32),out(2,'L1',32),out(3,'L2',32),out(4,'L2',32),out(5,'L3',32),out(6,'L3',32)]},
{name:'63 / 3 Type 4',input:'63A / 3',inputA:63,outputs:[out(1,'L1',16),out(2,'L2',16),out(3,'L3',16),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),out(7,'L1',16),out(8,'L2',16),out(9,'L3',16),out(10,'L1',32),out(11,'L2',32),out(12,'L3',32),out(13,'3Φ',32,true),out(14,'3Φ',32,true),out(15,'3Φ',63,true)]},
{name:'125 / 3 Type 2',input:'125A / 3',inputA:125,outputs:[out(1,'L1',16),out(2,'L2',16),out(3,'L3',16),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),out(7,'L1',16),out(8,'L2',16),out(9,'L3',16),out(10,'L1',16),out(11,'L2',16),out(12,'L3',16),out(13,'L1',32),out(14,'L2',32),out(15,'L3',32),out(16,'3Φ',32,true),out(17,'L1',32),out(18,'L2',32),out(19,'L3',32),out(20,'3Φ',32,true),out(21,'L1',63),out(22,'L2',63),out(23,'L3',63),out(24,'3Φ',63,true)]},
{name:'400a 72 Way Distro',input:'400A / 3',inputA:400,outputs:[out(1,'L1',16),out(2,'L2',16),out(3,'L3',16),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),socaOut(1),socaOut(2),socaOut(3),socaOut(4),socaOut(5),socaOut(6),socaOut(7),socaOut(8),socaOut(9),socaOut(10),socaOut(11),socaOut(12),Object.assign(out(19,'3Φ',32,true),{label:'19 32/3',displayName:'Output 19 – 32/3'}),Object.assign(out(20,'3Φ',63,true),{label:'20 63/3',displayName:'Output 20 – 63/3'}),Object.assign(out(21,'3Φ',400,true),{label:'Powerlock',displayName:'Output 21 – Powerlock'})]},
{name:'400a Type 1',input:'400A / 3',inputA:400,outputs:[out(1,'L1',16),out(2,'L2',16),out(3,'L3',16),out(4,'L1',16),out(5,'L2',16),out(6,'L3',16),out(7,'L1',16),out(8,'L2',16),out(9,'L3',16),out(10,'L1',16),out(11,'L2',16),out(12,'L3',16),out(13,'L1',16),out(14,'L2',16),out(15,'L3',16),out(16,'L1',16),out(17,'L2',16),out(18,'L3',16),out(19,'L1',16),out(20,'L2',16),out(21,'L3',16),out(22,'L1',16),out(23,'L2',16),out(24,'L3',16),out(25,'3Φ',32,true),out(26,'3Φ',32,true),out(27,'3Φ',32,true),out(28,'3Φ',63,true),out(29,'3Φ',63,true),out(30,'3Φ',63,true),out(31,'3Φ',125,true),out(32,'3Φ',125,true),out(33,'3Φ',125,true)]}
,{name:'Step Up: 32/3 > 63/3',input:'32A / 3',inputA:32,outputs:[Object.assign(out(1,'3Φ',63,true),{label:'1 63/3',displayName:'Output 1 – 63/3'})]}
,{name:'63/3 3 Phase Type 6',input:'63A / 3',inputA:63,outputs:[Object.assign(out(1,'3Φ',32,true),{label:'1 32/3',displayName:'Output 1 – 32/3'}),Object.assign(out(2,'3Φ',32,true),{label:'2 32/3',displayName:'Output 2 – 32/3'})]}
,{name:'Step Down: 63/3 > 32/3',input:'63A / 3',inputA:63,outputs:[Object.assign(out(1,'3Φ',32,true),{label:'1 32/3',displayName:'Output 1 – 32/3'})]}
,{name:'Step Up: 63/3 > 125/3',input:'63A / 3',inputA:63,outputs:[Object.assign(out(1,'3Φ',125,true),{label:'1 125/3',displayName:'Output 1 – 125/3'})]}
,{name:'Step Down: 125/3 > 63/3',input:'125A / 3',inputA:125,outputs:[Object.assign(out(1,'3Φ',63,true),{label:'1 63/3',displayName:'Output 1 – 63/3'})]}

];
