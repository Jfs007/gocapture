<template>
  <Icon :size="size" :depth="depth">
    <component :is="component" />
  </Icon>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@vicons/utils';
import {
  AddOutline,
  AlbumsOutline,
  ArrowBackOutline,
  BookOutline,
  CopyOutline,
  CloseOutline,
  CogOutline,
  ConstructOutline,
  FolderOpenOutline,
  HelpCircleOutline,
  ImagesOutline,
  LogoCodepen,
  RefreshOutline,
  SearchOutline,
  SettingsOutline
} from '@vicons/ionicons5';

const props = withDefaults(defineProps<{
  name: 'add' | 'agent' | 'albums' | 'back' | 'book' | 'close' | 'copy' | 'cog' | 'construct' | 'folder' | 'help' | 'images' | 'refresh' | 'search' | 'settings';
  size?: number;
  depth?: 1 | 2 | 3 | 4 | 5;
}>(), {
  size: 18,
  depth: 1
});

const icons = {
  add: AddOutline,
  agent: LogoCodepen,
  albums: AlbumsOutline,
  back: ArrowBackOutline,
  book: BookOutline,
  close: CloseOutline,
  copy: CopyOutline,
  cog: CogOutline,
  construct: ConstructOutline,
  folder: FolderOpenOutline,
  help: HelpCircleOutline,
  images: ImagesOutline,
  refresh: RefreshOutline,
  search: SearchOutline,
  settings: SettingsOutline
};

const component = computed(() => icons[props.name] || CogOutline);
</script>
