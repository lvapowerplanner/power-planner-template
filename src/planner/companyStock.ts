"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { DistroDefinition, EquipmentItem, PlannerOutput } from "./types";

function getCompanyPrefix() {
  const prefix = process.env.NEXT_PUBLIC_COMPANY_TABLE_PREFIX || "template";

  if (!/^[a-z0-9_]+$/i.test(prefix)) {
    throw new Error(
      "NEXT_PUBLIC_COMPANY_TABLE_PREFIX can only contain letters, numbers and underscores."
    );
  }

  return prefix.toLowerCase();
}

function tableName(baseName: "stock_equipment" | "stock_distros") {
  return `${getCompanyPrefix()}_${baseName}`;
}

function mapEquipmentRow(row: any): EquipmentItem {
  return {
    id: String(row.id),
    name: String(row.name ?? "Unnamed Equipment"),
    category: String(row.category ?? "Uncategorised"),
    watts: Number(row.watts ?? row.power_watts ?? 0),
  };
}

function normaliseInputConnector(value: unknown): string {
  return String(value ?? "").replace("3 Phase", "/ 3").replace("Single Phase", "/ 1");
}

function outputFromConnector(
  connector: string,
  index: number,
  phase: PlannerOutput["phase"]
): PlannerOutput {
  const ampsMatch = connector.match(/\d+/);
  const rating = ampsMatch ? Number(ampsMatch[0]) : 16;
 const normalisedConnector = connector.toLowerCase();

 const isThreePhase =
   normalisedConnector.includes("/ 3") ||
   normalisedConnector.includes("/3") ||
   normalisedConnector.includes("3 phase") ||
   normalisedConnector.includes("three phase");

  return {
    id: `out${index + 1}`,
    label: String(index + 1),
    phase: isThreePhase ? "3Φ" : phase,
    type: `${rating}A / ${isThreePhase ? "3" : "1"}`,
    rating,
    items: [],
  };
}

function mapDistroRow(row: any): DistroDefinition | null {
  if (row.definition && typeof row.definition === "object") {
    return row.definition as DistroDefinition;
  }

  const outputConnectors = Array.isArray(row.output_connectors)
    ? row.output_connectors
    : [];

  if (!row.name || !row.input_connector) {
    return null;
  }

  const phases: PlannerOutput["phase"][] = ["L1", "L2", "L3"];

  return {
    name: String(row.name),
    input: normaliseInputConnector(row.input_connector),
    inputA: Number(row.rating_amps ?? 0),
    outputs: outputConnectors.map((connector: string, index: number) =>
      outputFromConnector(connector, index, phases[index % phases.length])
    ),
  };
}

export async function loadCompanyEquipmentLibrary(): Promise<EquipmentItem[]> {
  const { data, error } = await supabase
    .from(tableName("stock_equipment"))
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load company equipment library:", error);
    return [];
  }

  return (data ?? []).map(mapEquipmentRow);
}

export async function loadCompanyDistroLibrary(): Promise<DistroDefinition[]> {
  const { data, error } = await supabase
    .from(tableName("stock_distros"))
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load company distro library:", error);
    return [];
  }

  return (data ?? [])
    .map(mapDistroRow)
    .filter((distro): distro is DistroDefinition => distro !== null);
}

export function useCompanyEquipmentLibrary() {
  const [equipmentLibrary, setEquipmentLibrary] = useState<EquipmentItem[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingEquipment(true);
      const equipment = await loadCompanyEquipmentLibrary();

      if (active) {
        setEquipmentLibrary(equipment);
        setLoadingEquipment(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return { equipmentLibrary, loadingEquipment };
}

export function useCompanyDistroLibrary() {
  const [distroLibrary, setDistroLibrary] = useState<DistroDefinition[]>([]);
  const [loadingDistros, setLoadingDistros] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingDistros(true);
      const distros = await loadCompanyDistroLibrary();

      if (active) {
        setDistroLibrary(distros);
        setLoadingDistros(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return { distroLibrary, loadingDistros };
}