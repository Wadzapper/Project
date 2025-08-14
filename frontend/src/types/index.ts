export interface Skill {
  id: string;
  name: string;
  level: number;
  xp: number;
  // icon and color can be added later as the UI evolves
}

export interface Pillar {
  id:string;
  name: string;
  skills: Skill[];
}
