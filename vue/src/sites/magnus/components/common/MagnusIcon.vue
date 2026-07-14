<template>
  <Icon :size="size" :depth="depth">
    <component :is="component" />
  </Icon>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@vicons/utils';
import {
  AlbumsOutline,
  ArrowBackOutline,
  BookOutline,
  CogOutline,
  ConstructOutline,
  FolderOpenOutline,
  ImagesOutline,
  RefreshOutline,
  SearchOutline
} from '@vicons/ionicons5';

const props = withDefaults(defineProps<{
  name: 'albums' | 'back' | 'book' | 'cog' | 'construct' | 'folder' | 'images' | 'refresh' | 'search';
  size?: number;
  depth?: 1 | 2 | 3 | 4 | 5;
}>(), {
  size: 18,
  depth: 1
});

const icons = {
  albums: AlbumsOutline,
  back: ArrowBackOutline,
  book: BookOutline,
  cog: CogOutline,
  construct: ConstructOutline,
  folder: FolderOpenOutline,
  images: ImagesOutline,
  refresh: RefreshOutline,
  search: SearchOutline
};

const component = computed(() => icons[props.name] || CogOutline);
</script>
