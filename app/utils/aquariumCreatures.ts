export type CreatureKind = "shark" | "seahorse" | "puffer" | "fish" | "jelly";
export type SwimDirection = "ltr" | "rtl";

export type CreaturePreset = {
  id: string;
  src: string;
  kind: CreatureKind;
  top: string;
  size: string;
  duration: string;
  delay: string;
  direction: SwimDirection;
  opacity: number;
};

export type SteeringProfile = {
  cruiseSpeed: number;
  maxSpeed: number;
  steering: number;
  verticalSpeed: number;
  wanderFrequency: number;
  cursorRadius: number;
  evadeVertical: number;
  evadeForward: number;
  fearBoost: number;
  curiosity: number;
  interestRadius: number;
  interestDistance: number;
  turnChance: number;
  decisionMin: number;
  decisionMax: number;
  /**
   * How the mascot feels about a rising bubble. Positive chases it (and bursts
   * it on contact), negative shies away, zero ignores bubbles entirely. The
   * magnitude scales the steering force, so it doubles as the strength.
   */
  bubbleInterest: number;
  /** How close a bubble has to be, in px, before it is noticed at all. */
  bubbleRadius: number;
};

export const MAX_VISIBLE_PETS = 4;

export const aquariumCreatures: CreaturePreset[] = [
  { id: "shark", src: "/images/ocean-creatures/shark-clean-hq-animated.webp", kind: "shark", top: "18%", size: "clamp(196px, 18.6vw, 340px)", duration: "34s", delay: "-9s", direction: "rtl", opacity: 0.88 },
  { id: "puffer", src: "/images/ocean-creatures/puffer-normal-animated.webp", kind: "puffer", top: "43%", size: "clamp(104px, 10vw, 175px)", duration: "25s", delay: "-3s", direction: "ltr", opacity: 0.9 },
  { id: "blue-fish", src: "/images/ocean-creatures/blue-fish-animated.webp", kind: "fish", top: "36%", size: "clamp(94px, 8vw, 151px)", duration: "31s", delay: "-17s", direction: "rtl", opacity: 0.86 },
  { id: "clownfish", src: "/images/ocean-creatures/clownfish-v2-animated.webp", kind: "fish", top: "77%", size: "clamp(80px, 7.2vw, 135px)", duration: "29s", delay: "-11s", direction: "ltr", opacity: 0.88 },
  { id: "seahorse", src: "/images/ocean-creatures/seahorse-clean-hq-animated.webp", kind: "seahorse", top: "61%", size: "clamp(73px, 6vw, 117px)", duration: "39s", delay: "-21s", direction: "rtl", opacity: 0.88 },
  { id: "jelly-blue", src: "/images/ocean-creatures/jelly-blue-animated.webp", kind: "jelly", top: "29%", size: "clamp(86px, 6.8vw, 132px)", duration: "43s", delay: "-28s", direction: "ltr", opacity: 0.7 },
  { id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink-hq-animated.webp", kind: "jelly", top: "72%", size: "clamp(80px, 6.3vw, 124px)", duration: "47s", delay: "-6s", direction: "rtl", opacity: 0.68 },
];

export const steeringProfiles: Record<CreatureKind, SteeringProfile> = {
  shark: { cruiseSpeed: 48, maxSpeed: 94, steering: 1.35, verticalSpeed: 13, wanderFrequency: 0.62, cursorRadius: 300, evadeVertical: 118, evadeForward: 38, fearBoost: 0.5, curiosity: 0.36, interestRadius: 470, interestDistance: 170, turnChance: 0.18, decisionMin: 10, decisionMax: 20, bubbleInterest: 0.25, bubbleRadius: 190 },
  puffer: { cruiseSpeed: 31, maxSpeed: 68, steering: 2.1, verticalSpeed: 18, wanderFrequency: 0.74, cursorRadius: 250, evadeVertical: 132, evadeForward: 30, fearBoost: 0.62, curiosity: 0.72, interestRadius: 410, interestDistance: 115, turnChance: 0.34, decisionMin: 7, decisionMax: 14, bubbleInterest: -0.85, bubbleRadius: 210 },
  fish: { cruiseSpeed: 36, maxSpeed: 78, steering: 2.25, verticalSpeed: 20, wanderFrequency: 0.82, cursorRadius: 255, evadeVertical: 138, evadeForward: 34, fearBoost: 0.7, curiosity: 0.7, interestRadius: 420, interestDistance: 110, turnChance: 0.28, decisionMin: 7, decisionMax: 15, bubbleInterest: 1, bubbleRadius: 260 },
  seahorse: { cruiseSpeed: 22, maxSpeed: 50, steering: 1.65, verticalSpeed: 22, wanderFrequency: 0.5, cursorRadius: 220, evadeVertical: 102, evadeForward: 20, fearBoost: 0.36, curiosity: 0.56, interestRadius: 350, interestDistance: 105, turnChance: 0.16, decisionMin: 11, decisionMax: 21, bubbleInterest: 0.55, bubbleRadius: 200 },
  jelly: { cruiseSpeed: 18, maxSpeed: 38, steering: 1.05, verticalSpeed: 25, wanderFrequency: 0.39, cursorRadius: 190, evadeVertical: 54, evadeForward: 10, fearBoost: 0.12, curiosity: 0.18, interestRadius: 280, interestDistance: 120, turnChance: 0.08, decisionMin: 15, decisionMax: 28, bubbleInterest: 0, bubbleRadius: 0 },
};

export const bodyAnimationBase: Record<CreatureKind, number> = {
  shark: 1.8,
  puffer: 2.4,
  fish: 1.7,
  seahorse: 2.2,
  jelly: 2.2,
};
