import {
  SKILL_BRANCH_META,
  SKILL_NODES,
  arePrerequisitesMet,
  canUnlockSkill,
} from '../game/skillTree';
import type { HudSnapshot, SkillBranch, SkillNode } from '../game/types';
import { SkillTreeIcon } from './Icons';

interface SkillTreeModalProps {
  hud: HudSnapshot;
  onUnlock: (nodeId: string) => boolean;
  onClose: () => void;
}

const BRANCHES: SkillBranch[] = ['combat', 'magic', 'utility'];

export function SkillTreeModal({ hud, onUnlock, onClose }: SkillTreeModalProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#08060e]/84 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rift Skill Tree"
    >
      <div className="obsidian-panel w-full max-w-[1120px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#c99b52]/25">
          <div className="flex items-center gap-3">
            <SkillTreeIcon className="w-6 h-6" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider text-[#f7f0e2]">
                Rift Mastery Tree
              </h2>
              <p className="text-xs text-[#b8adc9]">
                Invest Skill Points earned by leveling up into Combat, Magic, and Utility branches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#b8adc9]">
                Available Points
              </div>
              <div
                data-testid="skill-points-count"
                className="font-mono-num text-xl font-bold text-[#fde047]"
              >
                {hud.skillPoints}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#e6dccb] border border-[#4a405e] hover:border-[#f5c469] cursor-pointer whitespace-nowrap shrink-0"
            >
              Close [Esc]
            </button>
          </div>
        </div>

        {/* Three-Branch Skill Graph */}
        <div className="flex-1 overflow-y-auto touch-scroll-y p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {BRANCHES.map((branch) => {
            const meta = SKILL_BRANCH_META[branch];
            const nodes = SKILL_NODES.filter((n) => n.branch === branch);
            const tier1 = nodes.find((n) => n.tier === 1)!;
            const tier2Left = nodes.find((n) => n.tier === 2 && n.column === -1)!;
            const tier2Right = nodes.find((n) => n.tier === 2 && n.column === 1)!;
            const tier3 = nodes.find((n) => n.tier === 3)!;

            const isUnlocked = (id: string) => hud.unlockedSkills.includes(id);

            return (
              <div
                key={branch}
                className="flex flex-col bg-[#120f1c] border border-[#2d2642] p-4"
              >
                {/* Branch Header */}
                <div className="pb-3 mb-3 border-b border-[#2a233d]">
                  <h3
                    className="font-display text-base font-bold tracking-wider"
                    style={{ color: meta.color }}
                  >
                    {meta.name}
                  </h3>
                  <p className="text-[11px] text-[#a99ec0]">{meta.subtitle}</p>
                </div>

                {/* Tier 1 Root Node */}
                <SkillNodeCard
                  node={tier1}
                  branchColor={meta.color}
                  unlocked={isUnlocked(tier1.id)}
                  canUnlock={canUnlockSkill(tier1.id, hud.unlockedSkills, hud.skillPoints)}
                  prereqMet={arePrerequisitesMet(tier1, hud.unlockedSkills)}
                  onUnlock={onUnlock}
                />

                {/* SVG Connector Tier 1 -> Tier 2A & 2B */}
                <svg viewBox="0 0 240 28" className="w-full h-7 shrink-0" aria-hidden="true">
                  <path
                    d="M120 0 V12 H58 V28"
                    fill="none"
                    stroke={isUnlocked(tier1.id) ? meta.color : '#38304f'}
                    strokeWidth="2"
                  />
                  <path
                    d="M120 0 V12 H182 V28"
                    fill="none"
                    stroke={isUnlocked(tier1.id) ? meta.color : '#38304f'}
                    strokeWidth="2"
                  />
                </svg>

                {/* Tier 2 Split Nodes */}
                <div className="grid grid-cols-2 gap-2.5">
                  <SkillNodeCard
                    node={tier2Left}
                    branchColor={meta.color}
                    unlocked={isUnlocked(tier2Left.id)}
                    canUnlock={canUnlockSkill(tier2Left.id, hud.unlockedSkills, hud.skillPoints)}
                    prereqMet={arePrerequisitesMet(tier2Left, hud.unlockedSkills)}
                    onUnlock={onUnlock}
                    compact
                  />
                  <SkillNodeCard
                    node={tier2Right}
                    branchColor={meta.color}
                    unlocked={isUnlocked(tier2Right.id)}
                    canUnlock={canUnlockSkill(tier2Right.id, hud.unlockedSkills, hud.skillPoints)}
                    prereqMet={arePrerequisitesMet(tier2Right, hud.unlockedSkills)}
                    onUnlock={onUnlock}
                    compact
                  />
                </div>

                {/* SVG Connector Tier 2 -> Tier 3 Capstone */}
                <svg viewBox="0 0 240 28" className="w-full h-7 shrink-0" aria-hidden="true">
                  <path
                    d="M58 0 V14 H120 V28"
                    fill="none"
                    stroke={isUnlocked(tier2Left.id) ? meta.color : '#38304f'}
                    strokeWidth="2"
                  />
                  <path
                    d="M182 0 V14 H120 V28"
                    fill="none"
                    stroke={isUnlocked(tier2Right.id) ? meta.color : '#38304f'}
                    strokeWidth="2"
                  />
                </svg>

                {/* Tier 3 Capstone */}
                <SkillNodeCard
                  node={tier3}
                  branchColor={meta.color}
                  unlocked={isUnlocked(tier3.id)}
                  canUnlock={canUnlockSkill(tier3.id, hud.unlockedSkills, hud.skillPoints)}
                  prereqMet={arePrerequisitesMet(tier3, hud.unlockedSkills)}
                  onUnlock={onUnlock}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SkillNodeCard({
  node,
  branchColor,
  unlocked,
  canUnlock,
  prereqMet,
  onUnlock,
  compact = false,
}: {
  node: SkillNode;
  branchColor: string;
  unlocked: boolean;
  canUnlock: boolean;
  prereqMet: boolean;
  onUnlock: (id: string) => boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!canUnlock}
      onClick={() => onUnlock(node.id)}
      aria-label={`${unlocked ? 'Unlocked' : canUnlock ? 'Unlock' : 'Locked'} ${node.name}`}
      className={`w-full text-left border transition-colors flex flex-col ${
        compact ? 'p-2.5' : 'p-3.5'
      } ${
        unlocked
          ? 'bg-[#1f1a30] cursor-default'
          : canUnlock
            ? 'bg-[#181426] hover:bg-[#231d36] cursor-pointer'
            : 'bg-[#12101c] opacity-65 cursor-not-allowed'
      }`}
      style={{
        borderColor: unlocked
          ? branchColor
          : canUnlock
            ? `${branchColor}99`
            : '#2c2540',
      }}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span
          className={`font-display font-bold text-[#f7f0e2] leading-snug ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {node.name}
        </span>
        <span
          className="font-mono-num text-[10px] font-bold uppercase whitespace-nowrap shrink-0 mt-0.5"
          style={{
            color: unlocked
              ? branchColor
              : canUnlock
                ? '#fde047'
                : '#7a7091',
          }}
        >
          {unlocked ? 'Active' : canUnlock ? `Unlock (${node.cost})` : prereqMet ? 'Need Pt' : 'Locked'}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[#9d93b5] mb-1.5 whitespace-nowrap">
        {compact
          ? `${node.kind === 'active' ? 'Active' : 'Passive'} · T${node.tier}`
          : `${node.kind === 'active' ? 'Active Ability' : 'Passive Trait'} · Tier ${node.tier}`}
      </div>
      <p className="text-[11px] text-[#cfc5de] leading-relaxed">{node.summary}</p>
    </button>
  );
}
