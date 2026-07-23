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
  CogOutline,
  ConstructOutline,
  FolderOpenOutline,
  ImagesOutline,
  RefreshOutline,
  SearchOutline
} from '@vicons/ionicons5';

const props = withDefaults(defineProps<{
  name: 'add' | 'albums' | 'back' | 'book' | 'copy' | 'cog' | 'construct' | 'folder' | 'images' | 'refresh' | 'search';
  size?: number;
  depth?: 1 | 2 | 3 | 4 | 5;
}>(), {
  size: 18,
  depth: 1
});

const icons = {
  add: AddOutline,
  albums: AlbumsOutline,
  back: ArrowBackOutline,
  book: BookOutline,
  copy: CopyOutline,
  cog: CogOutline,
  construct: ConstructOutline,
  folder: FolderOpenOutline,
  images: ImagesOutline,
  refresh: RefreshOutline,
  search: SearchOutline
};

const component = computed(() => icons[props.name] || CogOutline);
</script>
