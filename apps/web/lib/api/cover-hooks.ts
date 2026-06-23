"use client";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { generateCover, listCoverLayouts, listCoverStyles, type GenerateCoverInput } from "./covers";
import { imageKeys } from "./image-hooks";
import type { CoverLayoutInfo, ImageStyleInfo, MediaAssetRead } from "./image-types";

export function useCoverStyles(): UseQueryResult<ImageStyleInfo[], Error> {
  return useQuery({ queryKey: ["cover-styles"], queryFn: listCoverStyles, staleTime: 5 * 60_000 });
}

export function useCoverLayouts(): UseQueryResult<CoverLayoutInfo[], Error> {
  return useQuery({ queryKey: ["cover-layouts"], queryFn: listCoverLayouts, staleTime: 5 * 60_000 });
}

export function useGenerateCover(): UseMutationResult<MediaAssetRead, Error, GenerateCoverInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateCoverInput) => generateCover(input),
    onSuccess: (asset) => {
      void qc.invalidateQueries({ queryKey: imageKeys.entity("cover", asset.entity_id ?? "") });
    },
  });
}
