// @polsia:user-owned — página del espacio privado del programa.
import type { Metadata } from 'next';
import { ProgramWorkspace } from '@/components/custom/program-workspace';

export const metadata: Metadata = {
  title: 'Programa de 12 semanas',
  description: 'Consulta los materiales educativos y tu progreso personal del programa.',
};

export default function ProgramPage() {
  return <ProgramWorkspace />;
}
