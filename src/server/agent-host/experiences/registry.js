'use strict';

const {
  loadExperienceContexts,
  loadExperienceMetas,
  recordExperienceVerification,
  saveCandidateExperience,
  updateStoredExperience,
} = require('../../experience/experience-store');

function listExperiences(project) {
  return loadExperienceMetas(project);
}

function readExperiences(project, ids) {
  return loadExperienceContexts(project, ids);
}

function verifyExperiences(project, ids) {
  return recordExperienceVerification(project, ids);
}

function saveGeneratedExperience(project, candidate) {
  return saveCandidateExperience(project, candidate);
}

function updateProjectExperience(project, input) {
  return updateStoredExperience(project, input);
}

module.exports = {
  listExperiences,
  readExperiences,
  saveGeneratedExperience,
  updateProjectExperience,
  verifyExperiences,
};
