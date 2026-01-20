export const ACTIVITY_IMAGES: Record<string, string> = {
  Users: "/activity-images/community_charity_volunteers.png",
  Football: "/activity-images/football_soccer_action_shot.png",
  Basketball: "/activity-images/basketball_players_in_action.png",
  Tennis: "/activity-images/tennis_player_serving.png",
  Swimming: "/activity-images/swimming_pool_athletes.png",
  Athletics: "/activity-images/athletics_track_runners.png",
  Cycling: "/activity-images/road_cycling_race.png",
  Dance: "/activity-images/dance_performance_artistic.png",
  MartialArts: "/activity-images/martial_arts_training.png",
  Music: "/activity-images/orchestra_music_performance.png",
  Palette: "/activity-images/artist_painting_studio.png",
  Theater: "/activity-images/theater_stage_performance.png",
  Camera: "/activity-images/photography_creative_session.png",
  BookOpen: "/activity-images/book_club_reading_group.png",
  TreePine: "/activity-images/nature_conservation_volunteers.png",
  Gamepad2: "/activity-images/chess_club_gaming_activity.png",
  Handshake: "/activity-images/community_charity_volunteers.png",
  Heart: "/activity-images/community_charity_volunteers.png",
  Dumbbell: "/activity-images/martial_arts_training.png",
  Bike: "/activity-images/road_cycling_race.png",
  Globe: "/activity-images/community_charity_volunteers.png",
  Star: "/activity-images/theater_stage_performance.png",
  Award: "/activity-images/athletics_track_runners.png",
  Zap: "/activity-images/martial_arts_training.png",
  Coffee: "/activity-images/community_charity_volunteers.png",
  Sparkles: "/activity-images/dance_performance_artistic.png",
  Utensils: "/activity-images/community_charity_volunteers.png",
};

export interface ActivityType {
  name: string;
  label: string;
  image: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { name: "Users", label: "General", image: ACTIVITY_IMAGES.Users },
  { name: "Football", label: "Football", image: ACTIVITY_IMAGES.Football },
  { name: "Basketball", label: "Basketball", image: ACTIVITY_IMAGES.Basketball },
  { name: "Tennis", label: "Tennis", image: ACTIVITY_IMAGES.Tennis },
  { name: "Swimming", label: "Natation", image: ACTIVITY_IMAGES.Swimming },
  { name: "Athletics", label: "Athletisme", image: ACTIVITY_IMAGES.Athletics },
  { name: "Cycling", label: "Cyclisme", image: ACTIVITY_IMAGES.Cycling },
  { name: "Dance", label: "Danse", image: ACTIVITY_IMAGES.Dance },
  { name: "MartialArts", label: "Arts Martiaux", image: ACTIVITY_IMAGES.MartialArts },
  { name: "Music", label: "Musique", image: ACTIVITY_IMAGES.Music },
  { name: "Palette", label: "Arts Plastiques", image: ACTIVITY_IMAGES.Palette },
  { name: "Theater", label: "Theatre", image: ACTIVITY_IMAGES.Theater },
  { name: "Camera", label: "Photographie", image: ACTIVITY_IMAGES.Camera },
  { name: "BookOpen", label: "Lecture", image: ACTIVITY_IMAGES.BookOpen },
  { name: "TreePine", label: "Nature/Environnement", image: ACTIVITY_IMAGES.TreePine },
  { name: "Gamepad2", label: "Jeux/Echecs", image: ACTIVITY_IMAGES.Gamepad2 },
  { name: "Handshake", label: "Solidarite", image: ACTIVITY_IMAGES.Handshake },
  { name: "Heart", label: "Sante/Bien-etre", image: ACTIVITY_IMAGES.Heart },
];

export function getActivityImage(activityName: string): string {
  return ACTIVITY_IMAGES[activityName] || ACTIVITY_IMAGES.Users;
}

export function getActivityInfo(activityName: string): ActivityType {
  const found = ACTIVITY_TYPES.find(i => i.name === activityName);
  if (found) return found;
  if (ACTIVITY_IMAGES[activityName]) {
    return { name: activityName, label: activityName, image: ACTIVITY_IMAGES[activityName] };
  }
  return ACTIVITY_TYPES[0];
}
