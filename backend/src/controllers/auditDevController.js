import Application from '../models/Application.js';
import JobDescription from '../models/JobDescription.js';
import MatchResult from '../models/MatchResult.js';
import { isAuditEnabled } from '../utils/audit.js';

const toStringId = (value) => (typeof value === 'string' ? value : value?.toString?.());

const sumWeights = (weights = {}) =>
  Object.values(weights || {}).reduce((total, value) => total + (Number(value) || 0), 0);

const pickRawScore = (application, matchResult) => {
  if (typeof application?.matchScore === 'number') return application.matchScore;
  if (typeof matchResult?.matchScore === 'number') return matchResult.matchScore;
  return null;
};

const deriveScoreScaleFlag = (rawScore, scoreBreakdown) => {
  if (typeof scoreBreakdown?.finalScore === 'number') {
    return scoreBreakdown.finalScore >= 0 && scoreBreakdown.finalScore <= 100;
  }
  if (rawScore === null) return null;
  if (rawScore > 1 && rawScore <= 100) return true;
  if (rawScore >= 0 && rawScore <= 1) return false;
  return null;
};

export const getMismatchChecklist = async (req, res, next) => {
  if (!isAuditEnabled()) {
    return res.status(403).json({ message: 'Audit mode disabled.' });
  }

  try {
    const { jobId } = req.params;
    const job = await JobDescription.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const [application, matchResult] = await Promise.all([
      Application.findOne({ jobId, candidateId: req.user.id }),
      MatchResult.findOne({ jobId, candidateId: req.user.id })
    ]);

    const resumeIdFromApp = toStringId(application?.resumeId);
    const resumeIdFromMatch = toStringId(matchResult?.resumeId);

    const rawScore = pickRawScore(application, matchResult);
    const scoreIn0to100Scale = deriveScoreScaleFlag(rawScore, matchResult?.scoreBreakdown);

    const requirementsCount = Array.isArray(job.requiredSkills) ? job.requiredSkills.length : 0;
    const totalWeight = sumWeights(job.scoringConfig?.weights);

    const checklist = {
      sameResumeIdUsedForScanAndApply:
        resumeIdFromApp && resumeIdFromMatch ? resumeIdFromApp === resumeIdFromMatch : null,
      requirementsCountGT0: requirementsCount > 0,
      totalWeightGT0: totalWeight > 0,
      scoreIn0to100Scale,
      applicationHasMatchScoreField: application
        ? Object.prototype.hasOwnProperty.call(application, 'matchScore')
        : false,
      UIFieldNameMatchesResponse: application
        ? Object.prototype.hasOwnProperty.call(application, 'matchScore')
        : false
    };

    return res.json({
      checklist,
      metadata: {
        jobId: toStringId(job?._id || jobId),
        resumeIdFromApp,
        resumeIdFromMatch,
        requirementsCount,
        totalWeight,
        scoreObserved: rawScore
      }
    });
  } catch (error) {
    return next(error);
  }
};

