<script setup lang="ts">
import FastNav from "~/components/redesign/FastNav.vue";
import HeroSection from "~/components/redesign/HeroSection.vue";
import ProfileSkills from "~/components/redesign/ProfileSkills.vue";
import ExperienceTimeline from "~/components/redesign/ExperienceTimeline.vue";
import PetProjectsGrid from "~/components/redesign/PetProjectsGrid.vue";
import ToolsRow from "~/components/redesign/ToolsRow.vue";
import ClosingCta from "~/components/redesign/ClosingCta.vue";

const { t } = useI18n();

useSeoMeta({
  title: () => t("seo.pages.home.title"),
  description: () => t("seo.pages.home.description"),
  robots: () => t("seo.common.robots"),
  ogType: "website",
  ogSiteName: () => t("seo.common.siteName"),
  ogTitle: () => t("seo.pages.home.ogTitle"),
  ogDescription: () => t("seo.pages.home.ogDescription"),
  twitterTitle: () => t("seo.pages.home.twitterTitle"),
  twitterDescription: () => t("seo.pages.home.twitterDescription"),
});
</script>

<template>
  <div class="home">
    <fast-nav />
    <hero-section />
    <div class="rd-divider" />
    <profile-skills />
    <div class="rd-divider" />
    <experience-timeline />
    <div class="rd-divider" />
    <pet-projects-grid />
    <div class="rd-divider" />
    <tools-row />
    <div class="rd-divider" />
    <closing-cta />
  </div>
</template>
