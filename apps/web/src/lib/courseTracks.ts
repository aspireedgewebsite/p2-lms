export const courseTracks = [
  { id: 'SKILL_BOOST', title: 'Skill Boost Courses', description: 'Build practical skills you can apply right away.' },
  { id: 'PROFESSIONAL_MASTERY', title: 'Professional Mastery Courses', description: 'Deepen your expertise with focused professional training.' },
  { id: 'CAREER_LAUNCH', title: 'Career Launch Courses', description: 'Build the skills you need for your next career step.' },
] as const;

export type CourseTrack = typeof courseTracks[number]['id'];

export function courseTrackInfo(track: string | null | undefined) {
  return courseTracks.find(item => item.id === track);
}
