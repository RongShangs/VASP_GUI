export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  mtime: string | null;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  mtime: string | null;
}


const VASP_FILE_TYPE_MAP: Record<string, string> = {
  INCAR: 'incar', KPOINTS: 'kpoints', POSCAR: 'poscar',
  POTCAR: 'potcar', OUTCAR: 'outcar', OSZICAR: 'oszicar',
  'vasprun.xml': 'vasprun', WAVECAR: 'binary', CHGCAR: 'binary',
  CONTCAR: 'poscar',
};

export function getVaspFileType(filename: string): string {
  return VASP_FILE_TYPE_MAP[filename] || 'text';
}
