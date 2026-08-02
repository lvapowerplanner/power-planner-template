"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { displayDistroName, outputDisplayName } from "@/planner/calculations";
import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";
import type { ProjectSignOffRecord, SignOffCompletion, SignOffDocument, SignOffElectrician, SignOffG1Certificate, SignOffG1Data, SignOffG2Result, SignOffG3Section, SignOffManualCircuit } from "@/types/signoff";

type SubTab = "shared" | "g1" | "g2" | "g3" | "circuits";
type CompletionState = "complete" | "partial" | "missing";
type ElectricianAccessLink = { id:string; status:string; token_prefix:string; electrician_name?:string; electrician_email?:string; electrician_company?:string; created_at:string; expires_at:string; first_accessed_at?:string; last_accessed_at?:string; submitted_at?:string; revoked_at?:string; generatedUrl?:string };

type CircuitReference = {
  id: string;
  distro: ProjectDistro;
  output: PlannerOutput;
  label: string;
  classification: "Distribution" | "Final";
  advanced: { load: CompletionState; cable: CompletionState; protection: CompletionState };
};

type SystemSignOffTabProps = {
  plannerState: PlannerState;
  projectId?: string;
  canManageAccessLink?: boolean;
  externalToken?: string;
  initialRecord?: ProjectSignOffRecord;
  projectName?: string;
  workspaceLogoUrl?: string | null;
  electricianDetails?: { name?: string; email?: string; company?: string };
};

const today = () => new Date().toISOString().slice(0, 10);
const hasAssignments = (output: PlannerOutput) => output.items.some((item) => item.quantity > 0);

function emptyResult(): SignOffG2Result {
  return { polarity: "", phaseSequence: "", measuredZsOhms: "", prospectiveFaultCurrentKa: "", rcdTestMethod: "", rcdOperatingTimeMs: "", comments: "", result: "not-tested" };
}

function blankG3Section(id = crypto.randomUUID()): SignOffG3Section {
  return { id, subsystem: "", responsiblePerson: "", organisation: "", certificateReference: "" };
}

function blankG1(): SignOffG1Data {
  return {
    certificateReference: "", coversSubsection: "", subsectionDetails: "", supplyPhase: "", maximumDemandUnit: "kVA", schematicAttached: "", sourceSupplyKind: "",
    sourceLocation: "", earthingArrangement: "", sourceOvercurrentSelected:false, sourceResidualSelected:false, sourceDeviceRating: "", sourceDeviceType: "", sourceRcdRatingMa: "", sourceRcdDelayMs: "",
    earthElectrodesDeployed: "", earthElectrodeDetails: "", earthingSystemsInterconnected: "", interconnectionDetails: "",
    isuDeviceRating: "", isuDeviceType: "", isuOvercurrentSelected:false, isuResidualSelected:false, isuRcdRatingMa: "", isuRcdDelayMs: "", deviations: "",
    visualInspectionSatisfactory: false, polaritySatisfactory: false, earthFaultLoopSatisfactory: false, rcdButtonsSatisfactory: false,
    equipmentEvidenceSatisfactory: false, supplyEarthLoopImpedanceOhms: "", reinspectionDate: "", declarationConfirmed: false, signature: "",
  };
}

function initialDocument(plannerState: PlannerState): SignOffDocument {
  return {
    sharedInformation: {
      eventName: plannerState.projectInfo?.projectName ?? plannerState.systemName ?? "",
      venue: plannerState.projectInfo?.venue ?? "",
      venueLocation: "",
      eventDate: plannerState.projectInfo?.eventDate ?? "",
      plannedRemovalDate: "",
      organisation: "",
      responsiblePerson: "",
      responsibility: "",
      onBehalfOf: "",
      email: "",
      signOffDate: today(),
      operatingPeriod: "",
      generalComments: "",
    },
    includedCircuitIds: [],
    autoFieldOverrides: {},
    g1: blankG1(),
    g1Forms: plannerState.sources.filter((source)=>!source.auto).map((source)=>({ ...blankG1(), id:`source:${source.id}`, sourceId:source.id, title:source.name })),
    g2: { completionCertificateReference: "", scheduleDate: today(), pageNumber: "1", pageCount: "1", combinedInstrument: false },
    g2Results: {},
    manualG2Circuits: [],
    completion: { g1:{}, g2:"", g3:"" },
    electricians: [],
    hiddenElectricianLinkIds: [],
    instruments: [],
    g3: { sections: plannerState.distros.map((distro) => ({ ...blankG3Section(`distro:${distro.id}`), subsystem: displayDistroName(distro) })), declarationConfirmed: false, signature: "", distributionOther: "", notApplicable: false },
  };
}

function mergeDocument(value: Partial<SignOffDocument> | undefined, plannerState: PlannerState): SignOffDocument {
  const base = initialDocument(plannerState);
  const legacyG1 = (value?.g1 ?? {}) as Partial<SignOffDocument["g1"]> & { systemCovered?: string; supplyDescription?: string; maximumDemand?: string; signedBy?: string };
  const legacyG3 = (value?.g3 ?? {}) as Partial<SignOffDocument["g3"]> & { subsystem?: string; completionCertificateReference?: string; seniorResponsiblePerson?: string; organisation?: string };
  const legacySection = legacyG3.subsystem || legacyG3.completionCertificateReference || legacyG3.seniorResponsiblePerson || legacyG3.organisation
    ? [{ id: "legacy", subsystem: legacyG3.subsystem ?? "", responsiblePerson: legacyG3.seniorResponsiblePerson ?? "", organisation: legacyG3.organisation ?? "", certificateReference: legacyG3.completionCertificateReference ?? "" }]
    : base.g3.sections;
  const savedForms = value?.g1Forms ?? [];
  const sourceForms = base.g1Forms.map((form,index) => savedForms.find((saved)=>saved.sourceId===form.sourceId) ?? (index===0&&!savedForms.length?{...form,...legacyG1}:form));
  const blankForms = savedForms.filter((form)=>form.sourceId===null);
  const g1Forms = [...sourceForms,...blankForms];
  return {
    ...base,
    ...value,
    sharedInformation: {
      ...base.sharedInformation,
      ...value?.sharedInformation,
      eventName: value?.sharedInformation?.eventName || base.sharedInformation.eventName,
      venue: value?.sharedInformation?.venue || base.sharedInformation.venue,
      eventDate: value?.sharedInformation?.eventDate || base.sharedInformation.eventDate,
    },
    autoFieldOverrides: { ...base.autoFieldOverrides, ...value?.autoFieldOverrides },
    g1: { ...base.g1, ...legacyG1 },
    g1Forms,
    g2: { ...base.g2, ...value?.g2 },
    g2Results: value?.g2Results ?? {},
    manualG2Circuits: value?.manualG2Circuits ?? [],
    completion: { ...base.completion, ...value?.completion, g1:{...base.completion.g1,...value?.completion?.g1} },
    electricians: value?.electricians ?? [],
    hiddenElectricianLinkIds: value?.hiddenElectricianLinkIds ?? [],
    instruments: value?.instruments ?? [],
    g3: { ...base.g3, ...legacyG3, sections: legacyG3.sections?.length ? legacyG3.sections : legacySection },
    includedCircuitIds: value?.includedCircuitIds ?? [],
  };
}

function deviceText(output: PlannerOutput) {
  const device = output.protectiveDevice;
  if (!device) return output.rating ? `${output.type || "Circuit"} ${output.rating} A` : "Not configured";
  return `${device.deviceType.toUpperCase()} ${device.ratedCurrentA} A${device.curve ? ` curve ${device.curve}` : ""}`;
}

function residualValues(output: PlannerOutput) {
  const residual = output.protectiveDevice?.residualProtection;
  return {
    mode: residual ? (residual.settingMode === "adjustable" ? "A" : "F") : "",
    delay: residual ? String(residual.timeDelayMs) : "",
    rating: residual ? String(residual.residualCurrentMa) : "",
  };
}

function completionState(output: PlannerOutput) {
  const loadConfigured = output.diversityPercent !== undefined || output.powerFactorOverride !== undefined;
  const cable = output.cableDesign;
  return {
    load: (loadConfigured ? "complete" : "partial") as CompletionState,
    cable: (!cable ? "missing" : cable.lengthMetres > 0 && cable.designerVerified ? "complete" : "partial") as CompletionState,
    protection: (output.protectiveDevice ? "complete" : "missing") as CompletionState,
  };
}

function circuitReferences(state: PlannerState): CircuitReference[] {
  const populatedDistroIds = new Set<string>();
  const isDistroPopulated = (distroId: string, visiting = new Set<string>()): boolean => {
    if (populatedDistroIds.has(distroId)) return true;
    if (visiting.has(distroId)) return false;
    visiting.add(distroId);
    const distro = state.distros.find((candidate) => candidate.id === distroId);
    if (!distro) return false;
    const populated = distro.outputs.some((output) => {
      if (output.phase === "Socapex" && (output.socaCircuits ?? []).some(hasAssignments)) return true;
      if (hasAssignments(output)) return true;
      const childSource = state.sources.find((source) => source.auto && source.parentDistroId === distro.id && source.parentOutputId === output.id);
      const child = childSource && state.distros.find((candidate) => candidate.sourceId === childSource.id);
      return child ? isDistroPopulated(child.id, new Set(visiting)) : false;
    });
    if (populated) populatedDistroIds.add(distroId);
    return populated;
  };

  return state.distros.flatMap((distro) => distro.outputs.flatMap((output, index) => {
    if (output.phase === "Socapex") {
      return (output.socaCircuits ?? []).filter(hasAssignments).map((circuit) => ({
        id: `${distro.id}:${output.id}:${circuit.id}`, distro, output: circuit,
        label: `${outputDisplayName(output, index)} / ${circuit.label}`, classification: "Final" as const, advanced: completionState(circuit),
      }));
    }
    const childSource = state.sources.find((source) => source.auto && source.parentDistroId === distro.id && source.parentOutputId === output.id);
    const childDistro = childSource && state.distros.find((candidate) => candidate.sourceId === childSource.id);
    const feedsDistro = Boolean(childDistro && isDistroPopulated(childDistro.id));
    if (!hasAssignments(output) && !feedsDistro) return [];
    return [{ id: `${distro.id}:${output.id}`, distro, output, label: outputDisplayName(output, index), classification: feedsDistro ? "Distribution" as const : "Final" as const, advanced: completionState(output) }];
  }));
}

function StatusBadge({ label, state }: { label: string; state: CompletionState }) {
  return <span style={{ ...styles.statusBadge, ...(state === "complete" ? styles.statusComplete : state === "partial" ? styles.statusPartial : styles.statusMissing) }}>{label}: {state === "complete" ? "Complete" : state === "partial" ? "Partial" : "Missing"}</span>;
}

function completionInfo(value:string|SignOffCompletion|undefined) {
  if(!value)return null;
  return typeof value==="string"?{completedAt:value,completedBy:"Not recorded"}:value;
}

export function SystemSignOffTab({ plannerState, projectId, canManageAccessLink = false, externalToken, initialRecord, projectName, workspaceLogoUrl, electricianDetails }: SystemSignOffTabProps) {
  const [record, setRecord] = useState<ProjectSignOffRecord | null>(initialRecord ?? null);
  const [document, setDocumentState] = useState<SignOffDocument>(() => mergeDocument(initialRecord?.document_data, plannerState));
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("shared");
  const [hoveredSubTab, setHoveredSubTab] = useState<SubTab | null>(null);
  const [loading, setLoading] = useState(!initialRecord);
  const [saveStatus, setSaveStatus] = useState("Loading...");
  const [error, setError] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [accessLinks, setAccessLinks] = useState<ElectricianAccessLink[]>([]);
  const [manualElectricianForm, setManualElectricianForm] = useState({name:"",email:"",company:""});
  const [removeElectricianPrompt, setRemoveElectricianPrompt] = useState<{kind:"link"|"manual";id:string;name:string;activeLink?:boolean}|null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [collapsedDistroIds, setCollapsedDistroIds] = useState<string[]>(() => plannerState.distros.map((distro) => distro.id));
  const [expandedCircuitIds, setExpandedCircuitIds] = useState<string[]>([]);
  const [activeG1Id, setActiveG1Id] = useState<string>("");
  const [collapsedInformation, setCollapsedInformation] = useState<string[]>([]);
  const [accountEmail, setAccountEmail] = useState("");
  const loadedRef = useRef(Boolean(initialRecord));
  const circuits = useMemo(() => circuitReferences(plannerState), [plannerState]);
  const submissionLocked = record?.status === "submitted" || record?.status === "superseded" || record?.status === "void";
  const activeCompletion = completionInfo(activeSubTab==="g1" ? document.completion.g1[activeG1Id] : activeSubTab==="g2" ? document.completion.g2 : activeSubTab==="g3" ? document.completion.g3 : undefined);
  const activeFormCompleted = Boolean(activeCompletion);
  const locked = submissionLocked || activeFormCompleted;
  const setDocument: React.Dispatch<React.SetStateAction<SignOffDocument>> = (action) => setDocumentState((current)=>{
    const next=typeof action==="function"?action(current):action;
    const removed=current.electricians.find((electrician)=>!next.electricians.some((candidate)=>candidate.id===electrician.id));
    if(removed){
      const hasActiveLink=accessLinks.some((link)=>link.status==="active"&&((removed.email&&link.electrician_email?.toLowerCase()===removed.email.toLowerCase())||(!removed.email&&link.electrician_name===removed.name)));
      window.setTimeout(()=>setRemoveElectricianPrompt({kind:"manual",id:removed.id,name:removed.name,activeLink:hasActiveLink}),0);
      return current;
    }
    return next;
  });

  useEffect(() => {
    if(externalToken)return;
    void supabase.auth.getUser().then(({data})=>setAccountEmail(data.user?.email??""));
  }, [externalToken]);

  useEffect(() => {
    if (initialRecord || !projectId) return;
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabase.rpc("get_or_create_project_signoff", { target_project_id: projectId });
      if (!active) return;
      if (loadError || !data) { setError(loadError?.message ?? "The sign-off draft could not be loaded."); setLoading(false); return; }
      const next = data as ProjectSignOffRecord;
      setRecord(next); setDocument(mergeDocument(next.document_data, plannerState)); setSaveStatus("Saved"); setLoading(false); loadedRef.current = true;
    })();
    return () => { active = false; };
  }, [initialRecord, plannerState, projectId]);

  useEffect(() => {
    if (!record || !loadedRef.current || submissionLocked) return;
    setSaveStatus("Unsaved changes");
    const timeout = window.setTimeout(async () => {
      setSaveStatus("Saving...");
      const response = externalToken
        ? await supabase.rpc("save_public_project_signoff", { access_token: externalToken, next_document_data: document, actor_name: document.sharedInformation.responsiblePerson || null, actor_email: document.sharedInformation.email || null, actor_company: document.sharedInformation.organisation || null })
        : await supabase.rpc("save_project_signoff", { target_signoff_id: record.id, next_document_data: document });
      if (response.error) { setSaveStatus("Save failed"); setError(response.error.message); return; }
      setSaveStatus("Saved");
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [document, externalToken, record, submissionLocked]);

  useEffect(() => {
    if (!document.g1Forms.length || document.g1Forms.some((form)=>form.id===activeG1Id)) return;
    const first = document.g1Forms[0];
    setActiveG1Id(first.id);
    setDocument((current)=>({...current,g1:{...first}}));
  }, [activeG1Id, document.g1Forms]);

  useEffect(() => {
    const manualSources=plannerState.sources.filter((source)=>!source.auto);
    const missing=manualSources.filter((source)=>!document.g1Forms.some((form)=>form.sourceId===source.id));
    const removed=document.g1Forms.some((form)=>form.sourceId!==null&&!manualSources.some((source)=>source.id===form.sourceId));
    const renamed=document.g1Forms.some((form)=>form.sourceId!==null&&manualSources.some((source)=>source.id===form.sourceId&&source.name!==form.title));
    if (!missing.length&&!removed&&!renamed) return;
    setDocument((current)=>({
      ...current,
      g1Forms:[
        ...manualSources.map((source)=>{
          const existing=current.g1Forms.find((form)=>form.sourceId===source.id);
          return existing?{...existing,title:source.name}:{...blankG1(),id:`source:${source.id}`,sourceId:source.id,title:source.name};
        }),
        ...current.g1Forms.filter((form)=>form.sourceId===null),
      ],
    }));
  }, [document.g1Forms, plannerState.sources]);

  useEffect(() => {
    if(record&&canManageAccessLink&&!externalToken) void loadAccessLinks();
  }, [record?.id, canManageAccessLink, externalToken]);

  const patchShared = (patch: Partial<SignOffDocument["sharedInformation"]>) => setDocument((current) => ({ ...current, sharedInformation: { ...current.sharedInformation, ...patch } }));
  const patchG1 = (patch: Partial<SignOffDocument["g1"]>) => setDocument((current) => ({ ...current, g1: { ...current.g1, ...patch }, g1Forms: current.g1Forms.map((form)=>form.id===activeG1Id?{...form,...patch}:form) }));
  const patchG2Header = (patch: Partial<SignOffDocument["g2"]>) => setDocument((current) => ({ ...current, g2: { ...current.g2, ...patch } }));
  const patchG3 = (patch: Partial<SignOffDocument["g3"]>) => setDocument((current) => ({ ...current, g3: { ...current.g3, ...patch } }));
  const patchG2 = (id: string, patch: Partial<SignOffG2Result>) => setDocument((current) => ({ ...current, g2Results: { ...current.g2Results, [id]: { ...(current.g2Results[id] ?? emptyResult()), ...patch } } }));
  const setOverride = (key: string, value?: string) => setDocument((current) => {
    const resolvedKey=key.startsWith("g1.")&&activeG1Id?`${activeG1Id}.${key}`:key;
    const next = { ...current.autoFieldOverrides };
    if (value === undefined) delete next[resolvedKey]; else next[resolvedKey] = value;
    return { ...current, autoFieldOverrides: next };
  });

  function addManualCircuit() {
    const circuit: SignOffManualCircuit = { id: crypto.randomUUID(), circuitDetails: "", finalCircuit: true, deviceTypeAndRating: "", rcdMode: "", rcdDelayMs: "", residualRatingMa: "" };
    setDocument((current) => ({ ...current, manualG2Circuits: [...current.manualG2Circuits, circuit] }));
  }

  function addBlankG1() {
    const next: SignOffG1Certificate = { ...blankG1(), id: crypto.randomUUID(), sourceId: null, title: `Blank G1 ${document.g1Forms.filter((form)=>form.sourceId===null).length+1}` };
    setDocument((current)=>({...current,g1:next,g1Forms:[...current.g1Forms,next]}));
    setActiveG1Id(next.id);
  }

  function patchManualCircuit(id: string, patch: Partial<SignOffManualCircuit>) {
    setDocument((current) => ({ ...current, manualG2Circuits: current.manualG2Circuits.map((circuit) => circuit.id === id ? { ...circuit, ...patch } : circuit) }));
  }

  function addManualElectrician() {
    if(!manualElectricianForm.name.trim())return;
    const electrician:SignOffElectrician={id:crypto.randomUUID(),name:manualElectricianForm.name.trim(),email:manualElectricianForm.email.trim(),company:manualElectricianForm.company.trim()};
    setDocument((current)=>({...current,electricians:[...current.electricians,electrician]}));
    setManualElectricianForm({name:"",email:"",company:""});
  }


  function toggleCircuit(id: string) {
    setDocument((current) => ({ ...current, includedCircuitIds: current.includedCircuitIds.includes(id) ? current.includedCircuitIds.filter((value) => value !== id) : [...current.includedCircuitIds, id] }));
  }

  async function loadAccessLinks() {
    if (!record || externalToken) return;
    const {data,error:linksError}=await supabase.rpc("list_project_signoff_links",{target_signoff_id:record.id});
    if(linksError){setLinkMessage(linksError.message);return;}
    setAccessLinks(((data as ElectricianAccessLink[] | null)??[]).filter((link)=>!document.hiddenElectricianLinkIds.includes(link.id)).map((link)=>({...link,generatedUrl:accessLinks.find((current)=>current.id===link.id)?.generatedUrl})));
  }

  async function createLink(details:{name:string;email:string;company:string}) {
    if (!record) return;
    if(!details.name.trim()||!details.email.trim()){setLinkMessage("Electrician name and email are required before a link can be generated.");return;}
    setLinkMessage("Creating link...");
    const { data, error: linkError } = await supabase.rpc("create_project_signoff_link", { target_signoff_id: record.id, electrician_name:details.name.trim(), electrician_email:details.email.trim(), electrician_company:details.company.trim()||null, expiry_days: 7 });
    if (linkError) { setLinkMessage(linkError.message); return; }
    const created=data as ElectricianAccessLink&{token?:string;active?:boolean};
    const generatedUrl=`${window.location.origin}/signoff-access/${created.token}`;
    setAccessLinks((current)=>[{...created,status:"active",generatedUrl},...current]); setLinkMessage("Link created. Its full URL is shown only in this session, so copy it now.");
  }

  async function performRevokeAccessLink(linkId:string) {
    const {error:revokeError}=await supabase.rpc("revoke_project_signoff_link",{target_link_id:linkId});
    if(revokeError){setLinkMessage(revokeError.message);return;}
    setAccessLinks((current)=>current.map((link)=>link.id===linkId?{...link,status:"revoked",revoked_at:new Date().toISOString(),generatedUrl:undefined}:link));
  }

  async function replaceElectricianLink(linkId:string,electrician:SignOffElectrician) {
    await performRevokeAccessLink(linkId);
    await createLink({name:electrician.name,email:electrician.email,company:electrician.company});
  }

  async function confirmRemoveElectrician() {
    const target=removeElectricianPrompt;
    if(!target)return;
    if(target.kind==="link"){
      if(target.activeLink)await performRevokeAccessLink(target.id);
      setAccessLinks((current)=>current.filter((link)=>link.id!==target.id));
      setDocument((current)=>({...current,hiddenElectricianLinkIds:[...new Set([...current.hiddenElectricianLinkIds,target.id])]}));
    }else{
      const electrician=document.electricians.find((candidate)=>candidate.id===target.id);
      const matchingLinks=electrician?accessLinks.filter((link)=>(electrician.email&&link.electrician_email?.toLowerCase()===electrician.email.toLowerCase())||(!electrician.email&&link.electrician_name===electrician.name)):[];
      for(const link of matchingLinks.filter((candidate)=>candidate.status==="active"))await performRevokeAccessLink(link.id);
      setAccessLinks((current)=>current.filter((link)=>!matchingLinks.some((candidate)=>candidate.id===link.id)));
      setDocumentState((current)=>({...current,electricians:current.electricians.filter((candidate)=>candidate.id!==target.id),hiddenElectricianLinkIds:[...new Set([...current.hiddenElectricianLinkIds,...matchingLinks.map((link)=>link.id)])]}));
    }
    setRemoveElectricianPrompt(null);
  }

  async function submitSignOff() {
    if (!record) return;
    const response = externalToken ? await supabase.rpc("submit_public_project_signoff", { access_token: externalToken }) : await supabase.rpc("submit_project_signoff", { target_signoff_id: record.id });
    if (response.error) { setError(response.error.message); setSubmitModalOpen(false); return; }
    setRecord(response.data as ProjectSignOffRecord); setSubmitModalOpen(false); setSaveStatus("Submitted and locked");
  }

  function exportPdf() {
    const popup = window.open("", "_blank");
    if (!popup) { setError("Allow pop-ups to export the sign-off PDF."); return; }
    popup.document.write(`<html><head><title>${projectName ?? record?.project_name ?? "System Sign-Off"}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;padding:0;color:#111}table{width:100%;border-collapse:collapse;margin:14px 0;table-layout:fixed}th,td{padding:6px;border:1px solid #333;text-align:left;vertical-align:top;font-size:9px;overflow-wrap:anywhere}h1{text-align:center}h2{padding:6px;background:#ddd;border:1px solid #333}.draft{padding:8px;background:#fff7e6;color:#92400e}@media print{button{display:none}}</style></head><body>${documentForPrint()}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  const overrideValue = (key: string, automatic: string) => document.autoFieldOverrides[key.startsWith("g1.")&&activeG1Id?`${activeG1Id}.${key}`:key] ?? automatic;
  const scopedAutoKey = (key:string) => key.startsWith("g1.")&&activeG1Id?`${activeG1Id}.${key}`:key;
  const selectedCircuits = circuits.filter((circuit) => document.includedCircuitIds.includes(circuit.id));
  function distroConnectedWatts(distroId: string, visited = new Set<string>()): number {
    if (visited.has(distroId)) return 0;
    visited.add(distroId);
    const distro = plannerState.distros.find((candidate)=>candidate.id===distroId);
    if (!distro) return 0;
    return distro.outputs.reduce((sum,output)=>{
      if (output.phase==="Socapex") return sum+(output.socaCircuits??[]).reduce((s,circuit)=>s+circuit.items.reduce((itemSum,item)=>itemSum+item.watts*item.quantity,0),0);
      const own=output.items.reduce((itemSum,item)=>itemSum+item.watts*item.quantity,0);
      const childSource=plannerState.sources.find((source)=>source.auto&&source.parentDistroId===distro.id&&source.parentOutputId===output.id);
      const child=childSource&&plannerState.distros.find((candidate)=>candidate.sourceId===childSource.id);
      return sum+own+(child?distroConnectedWatts(child.id,new Set(visited)):0);
    },0);
  }
  function outputApparentVa(output: PlannerOutput): number {
    const watts=output.items.reduce((sum,item)=>sum+item.watts*item.quantity,0);
    const diversifiedWatts=watts*((output.diversityPercent??100)/100);
    const circuitPf=plannerState.advancedElectrical?.calculationMethod==="include-power-factor"?(output.powerFactorOverride??plannerState.advancedElectrical.defaultPowerFactor):1;
    return diversifiedWatts/Math.max(circuitPf,0.1);
  }
  function distroApparentVa(distroId:string,visited=new Set<string>()):number {
    if(visited.has(distroId))return 0;
    visited.add(distroId);
    const distro=plannerState.distros.find((candidate)=>candidate.id===distroId);
    if(!distro)return 0;
    return distro.outputs.reduce((sum,output)=>{
      if(output.phase==="Socapex")return sum+(output.socaCircuits??[]).reduce((s,circuit)=>s+outputApparentVa(circuit),0);
      const childSource=plannerState.sources.find((source)=>source.auto&&source.parentDistroId===distro.id&&source.parentOutputId===output.id);
      const child=childSource&&plannerState.distros.find((candidate)=>candidate.sourceId===childSource.id);
      return sum+(child?distroApparentVa(child.id,new Set(visited)):outputApparentVa(output));
    },0);
  }
  function circuitConnectedWatts(circuit: CircuitReference): number {
    const own=circuit.output.items.reduce((sum,item)=>sum+item.watts*item.quantity,0);
    const childSource=plannerState.sources.find((source)=>source.auto&&source.parentDistroId===circuit.distro.id&&source.parentOutputId===circuit.output.id);
    const child=childSource&&plannerState.distros.find((candidate)=>candidate.sourceId===childSource.id);
    return own+(child?distroConnectedWatts(child.id):0);
  }
  function distroItems(distroId: string, visited = new Set<string>()): PlannerOutput["items"] {
    if (visited.has(distroId)) return [];
    visited.add(distroId);
    const distro=plannerState.distros.find((candidate)=>candidate.id===distroId);
    if (!distro) return [];
    return distro.outputs.flatMap((output)=>{
      const own=output.phase==="Socapex"?(output.socaCircuits??[]).flatMap((circuit)=>circuit.items.filter((item)=>item.quantity>0)):output.items.filter((item)=>item.quantity>0);
      const childSource=plannerState.sources.find((source)=>source.auto&&source.parentDistroId===distro.id&&source.parentOutputId===output.id);
      const child=childSource&&plannerState.distros.find((candidate)=>candidate.sourceId===childSource.id);
      return [...own,...(child?distroItems(child.id,new Set(visited)):[])];
    });
  }
  const activeG1Form = document.g1Forms.find((form)=>form.id===activeG1Id);
  const selectedSource = activeG1Form?.sourceId ? plannerState.sources.find((source)=>source.id===activeG1Form.sourceId&&!source.auto) : undefined;
  const connectedWatts = selectedSource ? plannerState.distros.filter((distro)=>distro.sourceId===selectedSource.id).reduce((sum,distro)=>sum+distroConnectedWatts(distro.id),0) : circuits.filter((circuit)=>circuit.classification==="Final").reduce((sum,circuit)=>sum+circuitConnectedWatts(circuit),0);
  const apparentVa = selectedSource ? plannerState.distros.filter((distro)=>distro.sourceId===selectedSource.id).reduce((sum,distro)=>sum+distroApparentVa(distro.id),0) : circuits.filter((circuit)=>circuit.classification==="Final").reduce((sum,circuit)=>sum+outputApparentVa(circuit.output),0);
  const maxDemandKva = apparentVa ? (apparentVa / 1000).toFixed(2) : "";
  const supplyPhase = activeG1Form?.sourceId===null ? "" : selectedSource?.phaseType === "Three-Phase" ? "Three-phase" : "Single phase";
  const nominalVoltage = selectedSource?.phaseType === "Three-Phase" ? (plannerState.advancedElectrical?.nominalThreePhaseVoltage??400) : (plannerState.advancedElectrical?.nominalSinglePhaseVoltage??230);
  const maxDemandAmps = connectedWatts ? (selectedSource?.phaseType === "Three-Phase" ? apparentVa/(Math.sqrt(3)*nominalVoltage) : apparentVa/nominalVoltage).toFixed(2) : "";
  const maximumDemandValue = activeG1Form?.sourceId===null ? "" : document.g1.maximumDemandUnit === "A" ? maxDemandAmps : maxDemandKva;
  const completingPerson = externalToken ? (electricianDetails?.email || electricianDetails?.name || "External electrician") : (accountEmail || document.sharedInformation.email || document.sharedInformation.responsiblePerson || "Project user");
  const sourceDescription = selectedSource ? `${selectedSource.name} (${selectedSource.conn})` : "";
  const certificateReference = document.g1.certificateReference || record?.certificate_reference || "";

  function documentForPrint() {
    return `<h1>System Sign-Off</h1>${locked ? "" : '<p class="draft">DRAFT - NOT SUBMITTED</p>'}<h2>G1 - Completion Certificate</h2><p><b>Event:</b> ${document.sharedInformation.eventName}</p><p><b>Venue:</b> ${document.sharedInformation.venue}</p><p><b>Supply:</b> ${overrideValue("g1.supply", sourceDescription)}</p><p><b>Maximum demand:</b> ${overrideValue("g1.maximumDemand", maxDemandKva)} kVA</p><h2>G2 - Schedule of Test Results</h2><table><tr><th>Circuit</th><th>Final</th><th>Type/rating</th><th>RCD</th><th>Polarity</th><th>Phase sequence</th><th>Zs</th><th>PSCC</th><th>Comments</th></tr>${selectedCircuits.map((circuit) => { const result = document.g2Results[circuit.id] ?? emptyResult(); return `<tr><td>${overrideValue(`circuit.${circuit.id}.description`, `${displayDistroName(circuit.distro)} / ${circuit.label}`)}</td><td>${circuit.classification === "Final" ? "Yes" : ""}</td><td>${overrideValue(`circuit.${circuit.id}.device`, deviceText(circuit.output))}</td><td>${residualValues(circuit.output).rating}</td><td>${result.polarity}</td><td>${result.phaseSequence}</td><td>${result.measuredZsOhms}</td><td>${result.prospectiveFaultCurrentKa}</td><td>${result.comments}</td></tr>`; }).join("")}</table><h2>G3 - Confirmation of Electrical Completion</h2><p><b>Event:</b> ${document.sharedInformation.eventName}</p><table><tr><th>Sub-system</th><th>Person Responsible</th><th>Organisation</th><th>Certificate reference</th></tr>${document.g3.sections.map((section) => `<tr><td>${section.subsystem}</td><td>${section.responsiblePerson}</td><td>${section.organisation}</td><td>${section.certificateReference}</td></tr>`).join("")}</table>`;
  }

  const input = (value: string, onChange: (value: string) => void, placeholder?: string) => <input style={styles.input} disabled={locked} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
  const textarea = (value: string, onChange: (value: string) => void) => <textarea style={styles.textarea} disabled={locked} value={value} onChange={(event) => onChange(event.target.value)} />;
  const sharedField = (label: string, value: string, onChange: (value: string) => void, multiline = false) => {
    if(label==="Other distribution")return null;
    if(label==="Signature / typed confirmation")return <label style={styles.formCell}><span style={styles.formLabel}>{label}</span><input style={styles.formInput} disabled={locked} value={value} onChange={(event)=>onChange(event.target.value)}/></label>;
    return <label style={styles.field}><span>{label}</span>{multiline ? textarea(value, onChange) : input(value, onChange)}</label>;
  };
  const signatureField = (value:string,onChange:(value:string)=>void) => <label style={styles.formCell}><span style={styles.formLabel}>Signature / typed confirmation</span><input style={styles.formInput} disabled={locked} value={value} onChange={(event)=>onChange(event.target.value)}/></label>;
  const autoField = (label: string, fieldKey: string, automatic: string, multiline = false) => {
    const key=scopedAutoKey(fieldKey);
    const automaticValue=fieldKey.startsWith("g1.")&&activeG1Form?.sourceId===null?"":automatic;
    const overridden = Object.prototype.hasOwnProperty.call(document.autoFieldOverrides, key);
    return <label style={styles.formCell}><span style={styles.formLabel}>{label}{automaticValue && <small style={styles.autoTag}>Auto</small>}</span>{multiline ? <textarea style={styles.formTextarea} disabled={locked} value={overrideValue(key, automaticValue)} onChange={(event) => setOverride(key, event.target.value)} /> : <input style={styles.formInput} disabled={locked} value={overrideValue(key, automaticValue)} onChange={(event) => setOverride(key, event.target.value)} />}{overridden && <button type="button" style={styles.resetAuto} disabled={locked} onClick={() => setOverride(key)}>Use automatic value</button>}</label>;
  };
  const subTabStyle = (tab: SubTab) => ({ ...styles.subTab, ...(activeSubTab === tab ? styles.activeSubTab : hoveredSubTab === tab ? styles.hoveredSubTab : styles.inactiveSubTab) });
  const g2Headings = ["Circuit details","Final circuit","Fuse / CB type and rating","RCD Fixed/Adjustable","Adjustable Delay (ms)","Residual Rating IΔn(mA)","RCD Test Method","Polarity","Phase sequence","Earth Fault Loop Impedance Zs Ω","Protective Short Circuit Current (PSCC) kA","Comments"];

  function plannedG2Row(circuit: CircuitReference) {
    const result=document.g2Results[circuit.id]??emptyResult();
    const residual=residualValues(circuit.output);
    const finalKey=`circuit.${circuit.id}.final`;
    const finalChecked=Object.hasOwn(document.autoFieldOverrides,finalKey)?document.autoFieldOverrides[finalKey]==="true":circuit.classification==="Final";
    return <tr key={circuit.id}><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.description`,`${displayDistroName(circuit.distro)} / ${circuit.label}`)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.description`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.description`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.description`)}/></td><td style={styles.checkboxCell}><input type="checkbox" disabled={locked} checked={finalChecked} onChange={(event)=>setOverride(finalKey,String(event.target.checked))}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.device`,deviceText(circuit.output))} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.device`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.device`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.device`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.rcdMode`,residual.mode)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.rcdMode`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.rcdMode`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.rcdMode`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.delay`,residual.delay)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.delay`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.delay`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.delay`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.rcdRating`,residual.rating)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.rcdRating`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.rcdRating`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.rcdRating`)}/></td><td><select disabled={locked} value={result.rcdTestMethod} onChange={(event)=>patchG2(circuit.id,{rcdTestMethod:event.target.value as SignOffG2Result["rcdTestMethod"]})}><option value="">Select</option><option value="test-button">Test button</option><option value="instrument">Measured</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.polarity} onChange={(event)=>patchG2(circuit.id,{polarity:event.target.value as SignOffG2Result["polarity"]})}><option value="">Select</option><option value="satisfactory">Satisfactory</option><option value="unsatisfactory">Unsatisfactory</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.phaseSequence} onChange={(event)=>patchG2(circuit.id,{phaseSequence:event.target.value as SignOffG2Result["phaseSequence"]})}><option value="">Select</option><option value="clockwise">Clockwise</option><option value="anticlockwise">Anticlockwise</option><option value="na">N/A</option></select></td><td>{input(result.measuredZsOhms,(value)=>patchG2(circuit.id,{measuredZsOhms:value}))}</td><td>{input(result.prospectiveFaultCurrentKa,(value)=>patchG2(circuit.id,{prospectiveFaultCurrentKa:value}))}</td><td>{input(result.comments,(value)=>patchG2(circuit.id,{comments:value}))}</td></tr>;
  }

  function manualG2Row(circuit: SignOffManualCircuit) {
    const result=document.g2Results[circuit.id]??emptyResult();
    return <tr key={circuit.id}><td>{input(circuit.circuitDetails,(value)=>patchManualCircuit(circuit.id,{circuitDetails:value}),"Circuit description")}</td><td style={styles.checkboxCell}><input type="checkbox" disabled={locked} checked={circuit.finalCircuit} onChange={(event)=>patchManualCircuit(circuit.id,{finalCircuit:event.target.checked})}/></td><td>{input(circuit.deviceTypeAndRating,(value)=>patchManualCircuit(circuit.id,{deviceTypeAndRating:value}))}</td><td>{input(circuit.rcdMode,(value)=>patchManualCircuit(circuit.id,{rcdMode:value}),"Fixed / Adjustable")}</td><td>{input(circuit.rcdDelayMs,(value)=>patchManualCircuit(circuit.id,{rcdDelayMs:value}))}</td><td>{input(circuit.residualRatingMa,(value)=>patchManualCircuit(circuit.id,{residualRatingMa:value}))}</td><td><select disabled={locked} value={result.rcdTestMethod} onChange={(event)=>patchG2(circuit.id,{rcdTestMethod:event.target.value as SignOffG2Result["rcdTestMethod"]})}><option value="">Select</option><option value="test-button">Test button</option><option value="instrument">Measured</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.polarity} onChange={(event)=>patchG2(circuit.id,{polarity:event.target.value as SignOffG2Result["polarity"]})}><option value="">Select</option><option value="satisfactory">Satisfactory</option><option value="unsatisfactory">Unsatisfactory</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.phaseSequence} onChange={(event)=>patchG2(circuit.id,{phaseSequence:event.target.value as SignOffG2Result["phaseSequence"]})}><option value="">Select</option><option value="clockwise">Clockwise</option><option value="anticlockwise">Anticlockwise</option><option value="na">N/A</option></select></td><td>{input(result.measuredZsOhms,(value)=>patchG2(circuit.id,{measuredZsOhms:value}))}</td><td>{input(result.prospectiveFaultCurrentKa,(value)=>patchG2(circuit.id,{prospectiveFaultCurrentKa:value}))}</td><td><div style={styles.manualComments}>{input(result.comments,(value)=>patchG2(circuit.id,{comments:value}))}<button style={styles.removeRowButton} disabled={locked} onClick={()=>setDocument((current)=>({...current,manualG2Circuits:current.manualG2Circuits.filter((row)=>row.id!==circuit.id)}))}>Remove row</button></div></td></tr>;
  }

  if (loading) return <section style={styles.state}>Loading System Sign-Off...</section>;
  if (error && !record) return <section style={styles.error}>{error}</section>;

  return <section className={`system-signoff${activeFormCompleted?" form-complete":""}`} style={styles.page}>
    <style>{`.g1-selector + section{display:none}.form-part-body>p{margin:0;padding:14px;line-height:1.5}.form-complete input:not([type="checkbox"]):not([type="radio"]):disabled,.form-complete select:disabled,.form-complete textarea:disabled{border-color:transparent!important;background:transparent!important;color:#344054!important;opacity:1!important}.form-complete input[type="checkbox"]:disabled,.form-complete input[type="radio"]:disabled{opacity:.7!important;accent-color:#667085}.form-complete section:not(.completion-control){filter:saturate(.35)}.form-complete .completion-control{filter:none}.system-signoff table input[type="checkbox"]{width:16px!important;height:16px!important;min-height:0!important}.system-signoff section[style*="max-height"]>div:last-child>div>div:first-child{display:grid;gap:4px;line-height:1.35}`}</style>
    <style>{`.system-signoff h2,.system-signoff h3,.system-signoff p{margin-top:0}.system-signoff strong{font-weight:700}.system-signoff table th,.system-signoff table td{text-align:left;vertical-align:top;padding:8px;border:1px solid #98a2b3}.system-signoff table th{background:#f2f4f7;font-weight:700;white-space:normal}.system-signoff table input,.system-signoff table select{width:100%;min-height:34px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:5px;padding:5px 7px;background:#fff}.system-signoff button:disabled,.system-signoff input:disabled,.system-signoff select:disabled,.system-signoff textarea:disabled{cursor:not-allowed;opacity:.7}`}</style>
    <header style={styles.header}><div><h2 style={styles.title}>System Sign-Off</h2><p style={styles.muted}>BS 7909 completion and test documentation - Revision {record?.revision ?? 1}</p></div><div style={styles.actions}><span style={styles.saveStatus}>{saveStatus}</span><button style={styles.secondaryButton} onClick={exportPdf}>Export Sign-Off PDF</button>{!submissionLocked && <button style={styles.primaryButton} onClick={() => setSubmitModalOpen(true)}>Submit Sign-Off</button>}</div></header>
    {error && <div style={styles.error}>{error}<button style={styles.closeError} onClick={() => setError("")}>x</button></div>}
    <nav style={styles.subTabs}>{([['shared','Information'],['g1','G1 - Completion Certificate'],['g2','G2 - Schedule of Test Results'],['g3','G3 - Confirmation of Electrical Completion'],['circuits','Include Circuits (G2)']] as [SubTab,string][]).map(([id,label]) => <button key={id} style={subTabStyle(id)} onMouseEnter={() => setHoveredSubTab(id)} onMouseLeave={() => setHoveredSubTab(null)} onClick={(event) => { setActiveSubTab(id); event.currentTarget.blur(); }}>{label}</button>)}</nav>

    {activeSubTab==="g2"&&<section style={styles.certificateHeaderShell}><CertificateHeader title="Schedule of Test Results" form="G2" logoUrl={workspaceLogoUrl} description="This schedule has to be accompanied by a valid Completion Certificate."/><div style={styles.certificateToolbar}><button style={styles.secondaryButton} disabled={locked} onClick={addManualCircuit}>Add blank circuit row</button></div></section>}
    {activeSubTab==="g3"&&<section style={styles.g3Applicability}><Check label="G3 is not applicable to this sign-off" checked={document.g3.notApplicable} disabled={locked} onChange={(value)=>patchG3({notApplicable:value})}/></section>}
    {activeSubTab==="g3"&&!document.g3.notApplicable&&<section style={styles.certificateHeaderShell}><CertificateHeader title="Confirmation of Electrical Completion" form="G3" logoUrl={workspaceLogoUrl} description="This Certificate summarises the individual completion certificates for each subsection of the temporary distribution described. It confirms that the temporary electrical system and its sub-systems associated with the event detailed below have been set-up, inspected and tested appropriately to ensure that they are safe and suitable for use. This form should be handed to the event manager. A copy should be available for the owner of the electrical supply which feeds the temporary system. It should be accompanied by the number of Completion Certificates and Schedules of Test Results as stated in row 4."/></section>}

    {activeSubTab === "shared" && <section style={styles.informationPage}>
      <div style={styles.informationHeading}><h3 style={styles.sectionTitle}>Information</h3><p style={{...styles.muted,margin:0}}>Shared details, electricians and sign-off progress.</p></div>
      <CollapsibleSection title="Project and shared information" collapsed={collapsedInformation.includes("project")} onToggle={()=>setCollapsedInformation((current)=>current.includes("project")?current.filter((id)=>id!=="project"):[...current,"project"])}>
        <div style={styles.formGrid}>{sharedField("Event / project", document.sharedInformation.eventName, (value) => patchShared({eventName:value}))}{sharedField("Location or venue", document.sharedInformation.venue, (value) => patchShared({venue:value}))}{sharedField("Venue address / location", document.sharedInformation.venueLocation, (value) => patchShared({venueLocation:value}))}{sharedField("Event / inspection date", document.sharedInformation.eventDate, (value) => patchShared({eventDate:value}))}{sharedField("Planned removal date", document.sharedInformation.plannedRemovalDate, (value) => patchShared({plannedRemovalDate:value}))}{sharedField("Responsible person", document.sharedInformation.responsiblePerson, (value) => patchShared({responsiblePerson:value}))}{sharedField("Responsibility on event", document.sharedInformation.responsibility, (value) => patchShared({responsibility:value}))}{sharedField("Organisation", document.sharedInformation.organisation, (value) => patchShared({organisation:value}))}{sharedField("For and on behalf of", document.sharedInformation.onBehalfOf, (value) => patchShared({onBehalfOf:value}))}{sharedField("Email", document.sharedInformation.email, (value) => patchShared({email:value}))}{sharedField("Sign-off date", document.sharedInformation.signOffDate, (value) => patchShared({signOffDate:value}))}{sharedField("Planned operating period", document.sharedInformation.operatingPeriod, (value) => patchShared({operatingPeriod:value}))}{sharedField("General comments", document.sharedInformation.generalComments, (value) => patchShared({generalComments:value}), true)}</div>
      </CollapsibleSection>
      <CollapsibleSection title="Electricians" collapsed={collapsedInformation.includes("electricians")} onToggle={()=>setCollapsedInformation((current)=>current.includes("electricians")?current.filter((id)=>id!=="electricians"):[...current,"electricians"])}>
        {externalToken&&<div style={styles.electricianCard}><div style={styles.linkIdentity}><strong>{electricianDetails?.name||"Assigned electrician"}</strong><span>{electricianDetails?.email||"Email not provided"}</span><small>{electricianDetails?.company||"Company not provided"}</small></div><span style={{...styles.trackerBadge,...styles.trackerComplete}}>This link</span></div>}
        {!externalToken&&<><div style={styles.electricianToolbar}><div style={styles.linkIdentity}><strong>Project electricians</strong><small>Add each electrician here, then manage their external access from their row.</small></div></div><div style={styles.manualElectricianForm}><input style={styles.input} placeholder="Name" value={manualElectricianForm.name} onChange={(event)=>setManualElectricianForm((current)=>({...current,name:event.target.value}))}/><input style={styles.input} placeholder="Email" value={manualElectricianForm.email} onChange={(event)=>setManualElectricianForm((current)=>({...current,email:event.target.value}))}/><input style={styles.input} placeholder="Company" value={manualElectricianForm.company} onChange={(event)=>setManualElectricianForm((current)=>({...current,company:event.target.value}))}/><button style={styles.secondaryButton} disabled={!manualElectricianForm.name.trim()} onClick={addManualElectrician}>Add electrician</button></div><div style={styles.electricianList}>{document.electricians.map((electrician)=>{const matchingLinks=accessLinks.filter((link)=>(electrician.email&&link.electrician_email?.toLowerCase()===electrician.email.toLowerCase())||(!electrician.email&&link.electrician_name===electrician.name));const activeLink=matchingLinks.find((link)=>link.status==="active");const latestLink=activeLink??matchingLinks[0];return <div key={`manual:${electrician.id}`} style={styles.electricianCard}><div style={styles.linkIdentity}><strong>{electrician.name}</strong><span>{electrician.email||"No email"}</span><small>{electrician.company||"No company"}</small>{latestLink&&<small>{latestLink.status} · expires {new Date(latestLink.expires_at).toLocaleString()}</small>}{latestLink?.generatedUrl&&<div style={styles.generatedLink}><input style={styles.linkInput} readOnly value={latestLink.generatedUrl}/><button style={styles.secondaryButton} onClick={()=>void navigator.clipboard.writeText(latestLink.generatedUrl!)}>Copy link</button></div>}</div><div style={styles.rowActions}>{latestLink?<span style={{...styles.trackerBadge,...(activeLink?styles.trackerComplete:styles.trackerOutstanding)}}>{latestLink.status}</span>:<span style={{...styles.trackerBadge,...styles.manualBadge}}>No link</span>}{canManageAccessLink&&(activeLink?<><button style={styles.secondaryButton} onClick={()=>void replaceElectricianLink(activeLink.id,electrician)}>Replace link</button><button style={styles.secondaryButton} onClick={()=>void performRevokeAccessLink(activeLink.id)}>Remove link</button></>:<button style={styles.secondaryButton} disabled={!electrician.email.trim()} onClick={()=>void createLink({name:electrician.name,email:electrician.email,company:electrician.company})}>Generate link</button>)}<button style={styles.dangerButton} onClick={()=>setDocument((current)=>({...current,electricians:current.electricians.filter((item)=>item.id!==electrician.id)}))}>Remove electrician</button></div></div>})}{document.electricians.length===0&&<p style={styles.empty}>No electricians have been added.</p>}</div>{linkMessage&&<p style={styles.linkMessage}>{linkMessage}</p>}</>}
      </CollapsibleSection>
      <CollapsibleSection title="Sign-off completion" collapsed={collapsedInformation.includes("completion")} onToggle={()=>setCollapsedInformation((current)=>current.includes("completion")?current.filter((id)=>id!=="completion"):[...current,"completion"])}><div style={styles.trackerGrid}>{document.g1Forms.map((form)=><CompletionStatus key={form.id} label={`G1 - ${form.title}`} completedAt={document.completion.g1[form.id]}/>) }<CompletionStatus label="G2 - Schedule of Test Results" completedAt={document.completion.g2}/><CompletionStatus label="G3 - Confirmation of Electrical Completion" completedAt={document.completion.g3}/></div></CollapsibleSection>
    </section>}

    {activeSubTab === "circuits" && <section style={styles.card}>
      <div style={styles.sectionHeader}><div><h3 style={styles.sectionTitle}>Include Circuits (G2)</h3><p style={styles.muted}>Select which populated circuits should be included on Form G2 - Schedule of Test Results. Only circuits carrying assigned equipment, or feeding a populated downstream distro, are shown.</p></div><div style={styles.compactActions}><button style={styles.secondaryButton} onClick={()=>setCollapsedDistroIds([])}>Expand all</button><button style={styles.secondaryButton} onClick={()=>setCollapsedDistroIds(plannerState.distros.map((distro)=>distro.id))}>Collapse all</button><button style={styles.textButton} disabled={locked} onClick={() => setDocument((current) => ({...current,includedCircuitIds:circuits.map((circuit)=>circuit.id)}))}>Select all</button><button style={styles.textButton} disabled={locked} onClick={() => setDocument((current) => ({...current,includedCircuitIds:[]}))}>Clear all</button></div></div>
      {circuits.length === 0 && <p style={styles.empty}>No populated circuits were found in the Distro Editor.</p>}
      {plannerState.distros.map((distro) => {
        const rows = circuits.filter((circuit) => circuit.distro.id === distro.id);
        if (!rows.length) return null;
        const collapsed = collapsedDistroIds.includes(distro.id);
        return <div key={distro.id} style={styles.distroGroup}>
          <button style={styles.distroHeader} onClick={()=>setCollapsedDistroIds((current)=>collapsed?current.filter((id)=>id!==distro.id):[...current,distro.id])}><span style={styles.distroIdentity}><strong>{displayDistroName(distro)}</strong><small>{rows.length} populated circuit{rows.length===1?"":"s"}</small></span><span>{collapsed ? "+" : "−"}</span></button>
          {!collapsed && rows.map((circuit)=>{
            const expanded=expandedCircuitIds.includes(circuit.id);
            const childSource=plannerState.sources.find((source)=>source.auto&&source.parentDistroId===circuit.distro.id&&source.parentOutputId===circuit.output.id);
            const childDistro=childSource&&plannerState.distros.find((candidate)=>candidate.sourceId===childSource.id);
            const equipment=childDistro?distroItems(childDistro.id):circuit.output.items.filter((item)=>item.quantity>0);
            return <div key={circuit.id} style={styles.circuitRow}><div style={styles.circuitSummary}><input type="checkbox" disabled={locked} checked={document.includedCircuitIds.includes(circuit.id)} onChange={()=>toggleCircuit(circuit.id)} /><button style={styles.circuitExpand} onClick={()=>setExpandedCircuitIds((current)=>expanded?current.filter((id)=>id!==circuit.id):[...current,circuit.id])}><span><strong>{circuit.label}</strong><small>{circuit.classification} - {deviceText(circuit.output)}</small></span><span>{expanded?"−":"+"}</span></button></div><span style={styles.badges}><StatusBadge label="Load & Demand" state={circuit.advanced.load}/><StatusBadge label="Cable" state={circuit.advanced.cable}/><StatusBadge label="Protection" state={circuit.advanced.protection}/></span>{expanded&&<div style={styles.circuitDetails}><Detail label="Assigned equipment" value={equipment.length?equipment.map((item)=>`${item.quantity} × ${item.name}${item.notes?` (${item.notes})`:""}`).join(", "):circuit.classification==="Distribution"?"Populated downstream distro":"None"}/><Detail label="Connected load" value={`${(equipment.reduce((sum,item)=>sum+item.watts*item.quantity,0)/1000).toFixed(2)} kW`}/><Detail label="Diversity" value={`${circuit.output.diversityPercent??100}%${circuit.output.diversityReason?` - ${circuit.output.diversityReason}`:""}`}/><Detail label="Power factor" value={String(circuit.output.powerFactorOverride??plannerState.advancedElectrical?.defaultPowerFactor??1)}/><Detail label="Cable" value={circuit.output.cableDesign?`${circuit.output.cableDesign.snapshot.cableName}, ${circuit.output.cableDesign.lengthMetres} m, ${circuit.output.cableDesign.parallelRuns} run(s)`:"Not configured"}/><Detail label="Protection" value={deviceText(circuit.output)}/><Detail label="Circuit notes" value={circuit.output.notes||"None"}/></div>}</div>;
          })}
        </div>;
      })}
    </section>}

    {activeSubTab === "g1" && <section className="g1-selector" style={styles.g1Selector}><label style={styles.field}><span>Select Completion Certificate</span><select style={styles.input} value={activeG1Id} onChange={(event)=>{const next=document.g1Forms.find((form)=>form.id===event.target.value);setActiveG1Id(event.target.value);if(next)setDocument((current)=>({...current,g1:{...next}}));}}>{document.g1Forms.map((form)=><option key={form.id} value={form.id}>{form.sourceId?`${form.title} - manual power source`:form.title}</option>)}</select></label>{activeG1Form?.sourceId===null&&<label style={styles.field}><span>Certificate name</span><input style={styles.input} disabled={locked} value={activeG1Form.title} onChange={(event)=>setDocument((current)=>({...current,g1Forms:current.g1Forms.map((form)=>form.id===activeG1Id?{...form,title:event.target.value}:form)}))}/></label>}<button style={styles.secondaryButton} disabled={locked} onClick={addBlankG1}>Add blank G1</button></section>}

    {activeSubTab === "g1" && <section style={styles.formSheet}><div style={styles.formTitle}><h2>Completion Certificate</h2><p>Form G1 for use with BS 7909</p></div><div style={styles.referenceRow}>{autoField("Certificate Reference No.", "g1.reference", certificateReference)}</div><FormPart title="Part 1: Description of the activity being covered and supply characteristics"><div style={styles.twoColumns}>{autoField("1. Event", "g1.event", document.sharedInformation.eventName)}{autoField("2. Location or venue", "g1.venue", [document.sharedInformation.venue, document.sharedInformation.venueLocation].filter(Boolean).join(", "))}{autoField("3. Subsection of a larger system - details", "g1.subsection", document.g1.subsectionDetails)}<label style={styles.formCell}><span style={styles.formLabel}>4. Supply</span><select style={styles.formInput} disabled={locked} value={document.g1.supplyPhase || (supplyPhase === "Three-phase" ? "three" : "single")} onChange={(event)=>patchG1({supplyPhase:event.target.value as SignOffDocument["g1"]["supplyPhase"]})}><option value="single">Single phase</option><option value="three">Three-phase</option></select></label>{autoField("5. Date of inspection and test", "g1.inspectionDate", document.sharedInformation.eventDate)}{autoField("Maximum demand (kVA)", "g1.maximumDemand", maxDemandKva)}</div></FormPart><FormPart title="Part 2: System details of supply used"><div style={styles.twoColumns}>{autoField("6. Source of supply used", "g1.supply", sourceDescription)}{autoField("Source location", "g1.sourceLocation", document.g1.sourceLocation)}{autoField("7. Supply earthing arrangements", "g1.earthing", document.g1.earthingArrangement)}{autoField("8. Protective devices at source of supply", "g1.sourceProtection", document.g1.sourceDeviceType || "Not configured")}{autoField("9. Additional earthing arrangements", "g1.additionalEarthing", document.g1.earthElectrodeDetails, true)}{autoField("10. Interconnection of earthing systems", "g1.interconnection", document.g1.interconnectionDetails, true)}{autoField("11. Protective devices in the ISU", "g1.isuProtection", document.g1.isuDeviceType || "Not applicable")}{autoField("13. Deviations or other significant information", "g1.deviations", document.g1.deviations, true)}</div></FormPart><FormPart title="Part 3: Essential inspection and tests"><div style={styles.checkGrid}><Check label="14. Visual inspection satisfactory" checked={document.g1.visualInspectionSatisfactory} disabled={locked} onChange={(value)=>patchG1({visualInspectionSatisfactory:value})}/><Check label="15. Polarity throughout satisfactory" checked={document.g1.polaritySatisfactory} disabled={locked} onChange={(value)=>patchG1({polaritySatisfactory:value})}/><Check label="16. Earth fault loop Z throughout satisfactory" checked={document.g1.earthFaultLoopSatisfactory} disabled={locked} onChange={(value)=>patchG1({earthFaultLoopSatisfactory:value})}/><Check label="17. RCD test buttons satisfactory" checked={document.g1.rcdButtonsSatisfactory} disabled={locked} onChange={(value)=>patchG1({rcdButtonsSatisfactory:value})}/><Check label="18. Equipment inspection and test evidence satisfactory" checked={document.g1.equipmentEvidenceSatisfactory} disabled={locked} onChange={(value)=>patchG1({equipmentEvidenceSatisfactory:value})}/>{autoField("19. Supply earth loop impedance (ohms)", "g1.supplyZs", document.g1.supplyEarthLoopImpedanceOhms)}{autoField("20. Planned duration", "g1.duration", document.sharedInformation.operatingPeriod)}{autoField("21. Date to re-inspect and re-test", "g1.reinspection", document.g1.reinspectionDate)}</div></FormPart><FormPart title="Part 4: Declaration"><p>I certify that the temporary electrical distribution system described above has been set up, inspected and tested and is safe and suitable for its intended purpose.</p><div style={styles.twoColumns}>{autoField("Name", "g1.name", document.sharedInformation.responsiblePerson)}{autoField("Responsibility on event", "g1.responsibility", document.sharedInformation.responsibility)}{autoField("For and on behalf of", "g1.onBehalf", document.sharedInformation.onBehalfOf)}{autoField("Date", "g1.date", document.sharedInformation.signOffDate)}{sharedField("Signature / typed confirmation", document.g1.signature, (value)=>patchG1({signature:value}))}<Check label="I confirm the G1 declaration" checked={document.g1.declarationConfirmed} disabled={locked} onChange={(value)=>patchG1({declarationConfirmed:value})}/></div></FormPart></section>}

    {activeSubTab === "g2" && <section style={styles.formSheetWide}><div style={styles.formTitle}><h2>Schedule of Test Results</h2><p>Form G2 for use with BS 7909</p></div><div style={styles.g2Header}>{autoField("Completion Certificate ref", "g2.reference", certificateReference)}{sharedField("Page", document.g2.pageNumber, (value)=>patchG2Header({pageNumber:value}))}{sharedField("of", document.g2.pageCount, (value)=>patchG2Header({pageCount:value}))}{autoField("Date", "g2.date", document.sharedInformation.signOffDate)}</div>{selectedCircuits.length===0?<p style={styles.empty}>Select populated circuits in Include Circuits to create the schedule.</p>:<div style={styles.tableWrap}><table style={styles.g2Table}><thead><tr><th>Circuit details</th><th>Final circuit</th><th>Fuse / CB type and rating</th><th>RCD F/A</th><th>Delay ms</th><th>IΔn mA</th><th>RCD test</th><th>Polarity</th><th>Phase sequence</th><th>Zs Ω</th><th>PSCC kA</th><th>Comments</th></tr></thead><tbody>{selectedCircuits.map((circuit)=>{const result=document.g2Results[circuit.id]??emptyResult();const residual=residualValues(circuit.output);return <tr key={circuit.id}><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.description`,`${displayDistroName(circuit.distro)} / ${circuit.label}`)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.description`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.description`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.description`)}/></td><td>{circuit.classification === "Final" ? "✓" : ""}</td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.device`,deviceText(circuit.output))} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.device`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.device`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.device`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.rcdMode`,residual.mode)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.rcdMode`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.rcdMode`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.rcdMode`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.delay`,residual.delay)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.delay`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.delay`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.delay`)}/></td><td><OverrideCell value={overrideValue(`circuit.${circuit.id}.rcdRating`,residual.rating)} overridden={Object.hasOwn(document.autoFieldOverrides,`circuit.${circuit.id}.rcdRating`)} disabled={locked} onChange={(value)=>setOverride(`circuit.${circuit.id}.rcdRating`,value)} onReset={()=>setOverride(`circuit.${circuit.id}.rcdRating`)}/></td><td><select disabled={locked} value={result.rcdTestMethod} onChange={(event)=>patchG2(circuit.id,{rcdTestMethod:event.target.value as SignOffG2Result["rcdTestMethod"]})}><option value="">-</option><option value="test-button">T</option><option value="instrument">M</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.polarity} onChange={(event)=>patchG2(circuit.id,{polarity:event.target.value as SignOffG2Result["polarity"]})}><option value="">-</option><option value="satisfactory">✓</option><option value="unsatisfactory">Fail</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.phaseSequence} onChange={(event)=>patchG2(circuit.id,{phaseSequence:event.target.value as SignOffG2Result["phaseSequence"]})}><option value="">-</option><option value="clockwise">Clockwise</option><option value="anticlockwise">Anticlockwise</option><option value="na">N/A</option></select></td><td>{input(result.measuredZsOhms,(value)=>patchG2(circuit.id,{measuredZsOhms:value}))}</td><td>{input(result.prospectiveFaultCurrentKa,(value)=>patchG2(circuit.id,{prospectiveFaultCurrentKa:value}))}</td><td>{input(result.comments,(value)=>patchG2(circuit.id,{comments:value}))}</td></tr>})}</tbody></table></div>}<FormPart title="Test instrument details"><Check label="Combined instrument" checked={document.g2.combinedInstrument} disabled={locked} onChange={(value)=>patchG2Header({combinedInstrument:value})}/><div style={styles.instrumentGrid}>{["Earth fault loop impedance", "Residual current tester", "Prospective short circuit current tester"].map((purpose,index)=>{const instrument=document.instruments[index]??{id:`instrument-${index}`,function:purpose,manufacturer:"",model:"",serialNumber:"",calibrationExpiry:""};return <div key={purpose} style={styles.instrumentCard}><strong>{purpose}</strong>{input(instrument.manufacturer,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,manufacturer:value};return {...current,instruments:next};}),"Manufacturer")}{input(instrument.model,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,model:value};return {...current,instruments:next};}),"Model")}{input(instrument.serialNumber,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,serialNumber:value};return {...current,instruments:next};}),"Serial number")}</div>})}</div></FormPart></section>}

    {activeSubTab === "g3" && !document.g3.notApplicable && <section style={styles.formSheet}><FormPart title="Part 1: Details of event"><div style={styles.twoColumns}>{autoField("1. Event", "g3.event", document.sharedInformation.eventName)}{autoField("2. Location or venue", "g3.venue", [document.sharedInformation.venue,document.sharedInformation.venueLocation].filter(Boolean).join(", "))}{autoField("3. Start date", "g3.start", document.sharedInformation.eventDate)}{autoField("Planned removal date", "g3.removal", document.sharedInformation.plannedRemovalDate)}{autoField("4. Number of certificates attached", "g3.certificateCount", String(document.g3.sections.filter((section)=>section.certificateReference).length))}</div></FormPart><FormPart title="Part 2: Schedule of sections"><div style={styles.tableWrap}><table style={styles.sectionTable}><thead><tr><th>Sub-system</th><th>Person Responsible</th><th>Organisation</th><th>Certificate reference</th><th></th></tr></thead><tbody>{document.g3.sections.map((section,index)=><tr key={section.id}><td>{input(section.subsystem,(value)=>updateG3Section(index,{subsystem:value}))}</td><td>{input(section.responsiblePerson,(value)=>updateG3Section(index,{responsiblePerson:value}))}</td><td>{input(section.organisation,(value)=>updateG3Section(index,{organisation:value}))}</td><td>{input(section.certificateReference,(value)=>updateG3Section(index,{certificateReference:value}))}</td><td><button style={styles.iconButton} disabled={locked} onClick={()=>patchG3({sections:document.g3.sections.filter((_,row)=>row!==index)})}>Remove</button></td></tr>)}</tbody></table></div><button style={styles.secondaryButton} disabled={locked} onClick={()=>patchG3({sections:[...document.g3.sections,blankG3Section()]})}>Add section</button></FormPart><FormPart title="Part 3: Confirmation"><p>As the Senior Person Responsible, I confirm that the temporary electrical systems listed above are safe and suitable for the purposes required by this event.</p><div style={styles.twoColumns}>{autoField("Print name", "g3.name", document.sharedInformation.responsiblePerson)}{autoField("For and on behalf of", "g3.onBehalf", document.sharedInformation.onBehalfOf)}{autoField("Date", "g3.date", document.sharedInformation.signOffDate)}{sharedField("Signature / typed confirmation", document.g3.signature, (value)=>patchG3({signature:value}))}{sharedField("Other distribution", document.g3.distributionOther, (value)=>patchG3({distributionOther:value}))}<Check label="I confirm the G3 declaration" checked={document.g3.declarationConfirmed} disabled={locked} onChange={(value)=>patchG3({declarationConfirmed:value})}/></div></FormPart></section>}

    {submitModalOpen&&<div style={styles.modalBackdrop}><section style={styles.modal}><h3>Submit Sign-Off?</h3><p>Submission locks this revision and consumes the external link. The account-holder email is queued after submission.</p><p><strong>{selectedCircuits.length}</strong> circuits are included; <strong>{selectedCircuits.filter((c)=>((document.g2Results[c.id]?.result??"not-tested") === "not-tested")).length}</strong> remain not tested.</p><div style={styles.modalActions}><button style={styles.primaryButton} onClick={submitSignOff}>Submit and lock</button><button style={styles.secondaryButton} onClick={()=>setSubmitModalOpen(false)}>Cancel</button></div></section></div>}
    {activeSubTab === "g2" && <section style={styles.manualSection}><div style={styles.sectionHeader}><div><h3 style={styles.sectionTitle}>Manually added circuits</h3><p style={styles.muted}>Add a circuit that is not present in the project design.</p></div><button style={styles.secondaryButton} disabled={locked} onClick={addManualCircuit}>Add circuit manually</button></div>{document.manualG2Circuits.length===0?<p style={styles.empty}>No manual circuits have been added.</p>:<div style={styles.tableWrap}><table style={styles.manualTable}><thead><tr><th>Circuit details</th><th>Final circuit</th><th>Fuse / CB type and rating</th><th>RCD F/A</th><th>Delay ms</th><th>IΔn mA</th><th></th></tr></thead><tbody>{document.manualG2Circuits.map((circuit)=><tr key={circuit.id}><td>{input(circuit.circuitDetails,(value)=>patchManualCircuit(circuit.id,{circuitDetails:value}))}</td><td><input type="checkbox" disabled={locked} checked={circuit.finalCircuit} onChange={(event)=>patchManualCircuit(circuit.id,{finalCircuit:event.target.checked})}/></td><td>{input(circuit.deviceTypeAndRating,(value)=>patchManualCircuit(circuit.id,{deviceTypeAndRating:value}))}</td><td>{input(circuit.rcdMode,(value)=>patchManualCircuit(circuit.id,{rcdMode:value}),"F / A")}</td><td>{input(circuit.rcdDelayMs,(value)=>patchManualCircuit(circuit.id,{rcdDelayMs:value}))}</td><td>{input(circuit.residualRatingMa,(value)=>patchManualCircuit(circuit.id,{residualRatingMa:value}))}</td><td><button style={styles.iconButton} disabled={locked} onClick={()=>setDocument((current)=>({...current,manualG2Circuits:current.manualG2Circuits.filter((row)=>row.id!==circuit.id)}))}>Remove</button></td></tr>)}</tbody></table></div>}</section>}
    {activeSubTab === "g2" && document.manualG2Circuits.length>0 && <section style={styles.manualSection}><h3 style={styles.sectionTitle}>Manual circuit test results</h3><div style={styles.tableWrap}><table style={styles.manualResultsTable}><thead><tr><th>Circuit</th><th>RCD test</th><th>Polarity</th><th>Phase sequence</th><th>Zs Ω</th><th>PSCC kA</th><th>Comments</th></tr></thead><tbody>{document.manualG2Circuits.map((circuit)=>{const result=document.g2Results[circuit.id]??emptyResult();return <tr key={circuit.id}><td>{circuit.circuitDetails||"Untitled manual circuit"}</td><td><select disabled={locked} value={result.rcdTestMethod} onChange={(event)=>patchG2(circuit.id,{rcdTestMethod:event.target.value as SignOffG2Result["rcdTestMethod"]})}><option value="">-</option><option value="test-button">T</option><option value="instrument">M</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.polarity} onChange={(event)=>patchG2(circuit.id,{polarity:event.target.value as SignOffG2Result["polarity"]})}><option value="">-</option><option value="satisfactory">Pass</option><option value="unsatisfactory">Fail</option><option value="na">N/A</option></select></td><td><select disabled={locked} value={result.phaseSequence} onChange={(event)=>patchG2(circuit.id,{phaseSequence:event.target.value as SignOffG2Result["phaseSequence"]})}><option value="">-</option><option value="clockwise">Clockwise</option><option value="anticlockwise">Anticlockwise</option><option value="na">N/A</option></select></td><td>{input(result.measuredZsOhms,(value)=>patchG2(circuit.id,{measuredZsOhms:value}))}</td><td>{input(result.prospectiveFaultCurrentKa,(value)=>patchG2(circuit.id,{prospectiveFaultCurrentKa:value}))}</td><td>{input(result.comments,(value)=>patchG2(circuit.id,{comments:value}))}</td></tr>})}</tbody></table></div></section>}
    {activeSubTab === "g2" && <section style={styles.g2Sheet}><div style={styles.g2TitleRow}><div><h2 style={styles.sectionTitle}>Schedule of Test Results</h2><p style={styles.muted}>Form G2 for use with BS 7909</p></div><button style={styles.secondaryButton} disabled={locked} onClick={addManualCircuit}>Add blank circuit row</button></div><div style={styles.g2CertificateHeader}>{autoField("Completion Certificate ref", "g2.reference", certificateReference)}{autoField("Date", "g2.date", document.sharedInformation.signOffDate)}</div>{selectedCircuits.length===0&&document.manualG2Circuits.length===0?<p style={styles.empty}>Select populated circuits in Include Circuits or add a blank circuit row.</p>:<div style={styles.tableWrap}><table style={styles.newG2Table}><thead><tr>{g2Headings.map((heading)=><th key={heading}>{heading}</th>)}</tr></thead><tbody>{selectedCircuits.map(plannedG2Row)}{document.manualG2Circuits.map(manualG2Row)}</tbody></table></div>}<FormPart title="Test instrument details"><Check label="Combined instrument" checked={document.g2.combinedInstrument} disabled={locked} onChange={(value)=>patchG2Header({combinedInstrument:value})}/><div style={styles.instrumentGrid}>{["Earth fault loop impedance", "Residual current tester", "Prospective short circuit current tester"].map((purpose,index)=>{const instrument=document.instruments[index]??{id:`instrument-${index}`,function:purpose,manufacturer:"",model:"",serialNumber:"",calibrationExpiry:""};return <div key={purpose} style={styles.instrumentCard}><strong>{purpose}</strong>{input(instrument.manufacturer,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,manufacturer:value};return {...current,instruments:next};}),"Manufacturer")}{input(instrument.model,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,model:value};return {...current,instruments:next};}),"Model")}{input(instrument.serialNumber,(value)=>setDocument((current)=>{const next=[...current.instruments];next[index]={...instrument,serialNumber:value};return {...current,instruments:next};}),"Serial number")}</div>})}</div></FormPart></section>}
    {activeSubTab === "g1" && <section style={styles.formSheet}><CertificateHeader title="Completion Certificate" form="G1" logoUrl={workspaceLogoUrl} description="This Certificate, showing the results of inspections and tests carried out on the temporary distribution described, should be handed to the event manager. A copy should be available for the owner of the electrical supply which feeds the temporary system. One certificate should be prepared for each electrically separate temporary distribution. This document is not valid without a completed Schedule of Test Results."/><div style={styles.referenceRow}>{autoField("Certificate Reference No.","g1.reference",certificateReference)}</div>
      <FormPart title="Part 1: Description of the activity being covered and supply characteristics"><div style={styles.twoColumns}>{autoField("1. Event","g1.event",document.sharedInformation.eventName)}{autoField("2. Location or venue","g1.venue",[document.sharedInformation.venue,document.sharedInformation.venueLocation].filter(Boolean).join(", "))}{autoField("3. Subsection of a larger system - details","g1.subsection",document.g1.subsectionDetails)}<div style={styles.formCell}><span style={styles.formLabel}>4. Supply and maximum demand</span><div style={styles.inlineChoices}><label><input type="radio" disabled={locked} checked={(document.g1.supplyPhase||(supplyPhase==="Three-phase"?"three":supplyPhase==="Single phase"?"single":""))==="single"} onChange={()=>patchG1({supplyPhase:"single"})}/> Single phase</label><label><input type="radio" disabled={locked} checked={(document.g1.supplyPhase||(supplyPhase==="Three-phase"?"three":supplyPhase==="Single phase"?"single":""))==="three"} onChange={()=>patchG1({supplyPhase:"three"})}/> Three-phase</label></div><div style={styles.demandRow}><label><span>Maximum demand</span><input style={styles.formInput} disabled={locked} value={overrideValue("g1.maximumDemand",maximumDemandValue)} onChange={(event)=>setOverride("g1.maximumDemand",event.target.value)}/></label><select style={styles.formInput} disabled={locked} value={document.g1.maximumDemandUnit} onChange={(event)=>patchG1({maximumDemandUnit:event.target.value as "A"|"kVA"})}><option value="kVA">kVA</option><option value="A">A</option></select>{Object.hasOwn(document.autoFieldOverrides,scopedAutoKey("g1.maximumDemand"))&&<button type="button" style={styles.reloadButton} disabled={locked} title="Reload calculated maximum demand" aria-label="Reload calculated maximum demand" onClick={()=>setOverride("g1.maximumDemand")}>↻</button>}</div><small style={styles.fieldHelp}>Calculated from the connected load assigned to this source, including downstream distros, with diversity and configured power factor applied.</small></div>{autoField("5. Date of inspection and test","g1.inspectionDate",document.sharedInformation.eventDate)}</div></FormPart>
      <FormPart title="Part 2: System details of supply used"><div style={styles.numberedRows}><div style={styles.numberedRow}><strong>6. Source of supply used</strong><div style={styles.sourceGrid}><label style={styles.field}><span>Supply type</span><select style={styles.input} disabled={locked} value={document.g1.sourceSupplyKind} onChange={(event)=>patchG1({sourceSupplyKind:event.target.value as SignOffDocument["g1"]["sourceSupplyKind"]})}><option value="">Select supply type</option><option value="generator">Generator</option><option value="installed">Installed supply</option></select></label><label style={styles.field}><span>Source location</span><input style={styles.input} disabled={locked} value={document.g1.sourceLocation} onChange={(event)=>patchG1({sourceLocation:event.target.value})}/></label></div></div><div style={styles.numberedRow}><strong>7. Supply earthing arrangements</strong><div style={styles.inlineChoices}>{["TN-S","TT","TN-C-S","IT (see BS 7909:2011, C.4.5)"].map((option)=><label key={option}><input type="radio" disabled={locked} checked={document.g1.earthingArrangement===option} onChange={()=>patchG1({earthingArrangement:option})}/>{option}</label>)}</div></div><ProtectionChoice number="8" title="Protective devices at source of supply" overcurrent={document.g1.sourceOvercurrentSelected} residual={document.g1.sourceResidualSelected} rating={document.g1.sourceDeviceRating} type={document.g1.sourceDeviceType} residualRating={document.g1.sourceRcdRatingMa} delay={document.g1.sourceRcdDelayMs} disabled={locked} onPatch={(patch)=>patchG1({sourceOvercurrentSelected:patch.overcurrent??document.g1.sourceOvercurrentSelected,sourceResidualSelected:patch.residual??document.g1.sourceResidualSelected,sourceDeviceRating:patch.rating??document.g1.sourceDeviceRating,sourceDeviceType:patch.type??document.g1.sourceDeviceType,sourceRcdRatingMa:patch.residualRating??document.g1.sourceRcdRatingMa,sourceRcdDelayMs:patch.delay??document.g1.sourceRcdDelayMs})}/><div style={styles.numberedRow}><strong>9. Additional earthing arrangements</strong><Check label="Are earth electrodes deployed?" checked={document.g1.earthElectrodesDeployed==="yes"} disabled={locked} onChange={(value)=>patchG1({earthElectrodesDeployed:value?"yes":"no"})}/>{document.g1.earthElectrodesDeployed==="yes"&&sharedField("Give details, including type and location",document.g1.earthElectrodeDetails,(value)=>patchG1({earthElectrodeDetails:value}),true)}</div><div style={styles.numberedRow}><strong>10. Interconnection of earthing systems</strong><Check label="Have deliberate connections between the temporary distribution and any other system been made?" checked={document.g1.earthingSystemsInterconnected==="yes"} disabled={locked} onChange={(value)=>patchG1({earthingSystemsInterconnected:value?"yes":"no"})}/>{document.g1.earthingSystemsInterconnected==="yes"&&sharedField("State interconnection details",document.g1.interconnectionDetails,(value)=>patchG1({interconnectionDetails:value}),true)}</div><ProtectionChoice number="11" title="Protective devices in the ISU (if present)" overcurrent={document.g1.isuOvercurrentSelected} residual={document.g1.isuResidualSelected} rating={document.g1.isuDeviceRating} type={document.g1.isuDeviceType} residualRating={document.g1.isuRcdRatingMa} delay={document.g1.isuRcdDelayMs} disabled={locked} onPatch={(patch)=>patchG1({isuOvercurrentSelected:patch.overcurrent??document.g1.isuOvercurrentSelected,isuResidualSelected:patch.residual??document.g1.isuResidualSelected,isuDeviceRating:patch.rating??document.g1.isuDeviceRating,isuDeviceType:patch.type??document.g1.isuDeviceType,isuRcdRatingMa:patch.residualRating??document.g1.isuRcdRatingMa,isuRcdDelayMs:patch.delay??document.g1.isuRcdDelayMs})}/><div style={styles.statementRow}><strong>12.</strong><span>Final circuit details and tests should be shown on a G2 - Schedule of Test Results, where appropriate.</span></div><div style={styles.numberedRow}><strong>13. Specify any deviations from BS 7909 or the design, or other significant information</strong>{textarea(document.g1.deviations,(value)=>patchG1({deviations:value}))}</div></div></FormPart>
      <FormPart title="Part 3: Essential inspection and tests"><div style={styles.part3Rows}><div style={styles.part3Pair}><Check label="14. Visual inspection satisfactory" checked={document.g1.visualInspectionSatisfactory} disabled={locked} onChange={(value)=>patchG1({visualInspectionSatisfactory:value})}/><Check label="15. Polarity throughout satisfactory" checked={document.g1.polaritySatisfactory} disabled={locked} onChange={(value)=>patchG1({polaritySatisfactory:value})}/></div><div style={styles.part3Pair}><Check label="16. Earth fault loop Z throughout satisfactory" checked={document.g1.earthFaultLoopSatisfactory} disabled={locked} onChange={(value)=>patchG1({earthFaultLoopSatisfactory:value})}/><Check label="17. RCD test buttons satisfactory" checked={document.g1.rcdButtonsSatisfactory} disabled={locked} onChange={(value)=>patchG1({rcdButtonsSatisfactory:value})}/></div><div style={styles.part3Single}><Check label="18. Evidence of formal inspection and test provided and satisfactory for electrical equipment." checked={document.g1.equipmentEvidenceSatisfactory} disabled={locked} onChange={(value)=>patchG1({equipmentEvidenceSatisfactory:value})}/></div><div style={styles.part3Single}>{autoField("19. Earth loop impedance of the supply (Ω)","g1.supplyZs",document.g1.supplyEarthLoopImpedanceOhms)}</div><div style={styles.part3Pair}>{autoField("20. Planned duration of this system","g1.duration",document.sharedInformation.operatingPeriod)}{autoField("21. Date to re-inspect and re-test this system","g1.reinspection",document.g1.reinspectionDate)}</div></div></FormPart>
      <FormPart title="Part 4: Declaration"><p style={styles.declaration}>I certify that the temporary electrical distribution system described above has been set-up in accordance with the recommendations of BS 7909:2011 and inspection and testing has been completed. To the best of my knowledge and belief, the system is safe and suitable for the intended purpose.</p><div style={styles.twoColumns}>{autoField("Name","g1.name",document.sharedInformation.responsiblePerson)}{autoField("Responsibility on event","g1.responsibility",document.sharedInformation.responsibility)}{autoField("For and on behalf of","g1.onBehalf",document.sharedInformation.onBehalfOf)}{autoField("Date","g1.date",document.sharedInformation.signOffDate)}{signatureField(document.g1.signature,(value)=>patchG1({signature:value}))}<Check label="I confirm the G1 declaration" checked={document.g1.declarationConfirmed} disabled={locked} onChange={(value)=>patchG1({declarationConfirmed:value})}/></div></FormPart>
    </section>}
    {(activeSubTab==="g1"||activeSubTab==="g2"||activeSubTab==="g3")&&<section className="completion-control" style={activeFormCompleted?styles.completedControl:styles.completionControl}><div style={styles.completionIdentity}><strong>{activeFormCompleted?"Form complete":"Complete this form"}</strong><small>{activeCompletion?`Completed by ${activeCompletion.completedBy} - ${new Date(activeCompletion.completedAt).toLocaleString()}. Revoke completion if further edits are required.`:"Completing the form locks its fields and displays the saved values. Completion can be revoked if further edits are required."}</small></div>{activeFormCompleted?<button style={styles.revokeButton} disabled={Boolean(submissionLocked)} onClick={()=>setDocument((current)=>activeSubTab==="g1"?{...current,completion:{...current.completion,g1:Object.fromEntries(Object.entries(current.completion.g1).filter(([id])=>id!==activeG1Id))}}:activeSubTab==="g2"?{...current,completion:{...current.completion,g2:""}}:{...current,completion:{...current.completion,g3:""}})}>Revoke completion</button>:<button style={styles.completeButton} disabled={Boolean(submissionLocked)||(activeSubTab==="g1"&&!activeG1Id)} onClick={()=>{const completion:SignOffCompletion={completedAt:new Date().toISOString(),completedBy:completingPerson};setDocument((current)=>activeSubTab==="g1"?{...current,completion:{...current.completion,g1:{...current.completion.g1,[activeG1Id]:completion}}}:activeSubTab==="g2"?{...current,completion:{...current.completion,g2:completion}}:{...current,completion:{...current.completion,g3:completion}});}}>Complete</button>}</section>}
    {removeElectricianPrompt&&<div style={styles.modalBackdrop}><section style={styles.modal}><h3>Remove electrician from project?</h3><p><strong>{removeElectricianPrompt.name}</strong> will be removed from the project.{removeElectricianPrompt.activeLink?" Their active external link will also be revoked.":""}</p><p>Any form values or test results they have already entered will be retained.</p><div style={styles.modalActions}><button style={styles.dangerButton} onClick={()=>void confirmRemoveElectrician()}>Remove electrician</button><button style={styles.secondaryButton} onClick={()=>setRemoveElectricianPrompt(null)}>Cancel</button></div></section></div>}
  </section>;

  function updateG3Section(index: number, patch: Partial<SignOffG3Section>) {
    const sections = document.g3.sections.map((section,row)=>row===index?{...section,...patch}:section);
    patchG3({sections});
  }
}

function FormPart({ title, children }: { title: string; children: React.ReactNode }) { return <section style={styles.formPart}><h3 style={styles.partTitle}>{title}</h3><div className="form-part-body" style={styles.partBody}>{children}</div></section>; }
function CertificateHeader({title,form,description,logoUrl}:{title:string;form:"G1"|"G2"|"G3";description:string;logoUrl?:string|null}) { return <div style={styles.certificateHeader}>{logoUrl?<img src={logoUrl} alt="Company logo" style={styles.certificateLogo}/>:<span style={styles.certificateLogoSpace}/>}<div style={styles.certificateHeading}><h2 style={styles.certificateTitle}>{title}</h2><p style={styles.certificateSubtitle}>(Form {form} for use with BS 7909, Code of practice for temporary electrical systems for entertainment and related purposes)</p><p style={styles.certificateDescription}>{description}</p></div><span style={styles.certificateLogoSpace}/></div>; }

function Check({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled?:boolean;onChange:(value:boolean)=>void}) { return <label style={styles.check}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event)=>onChange(event.target.checked)}/>{label}</label>; }
function OverrideCell({value,overridden,disabled,onChange,onReset}:{value:string;overridden:boolean;disabled?:boolean;onChange:(value:string)=>void;onReset:()=>void}) { return <div style={styles.overrideCell}><input disabled={disabled} value={value} onChange={(event)=>onChange(event.target.value)}/>{overridden&&<button type="button" disabled={disabled} title="Use automatic value" onClick={onReset}>↺</button>}</div>; }
function Detail({label,value}:{label:string;value:string}) { return <div style={styles.detail}><span>{label}</span><strong>{value}</strong></div>; }
function CollapsibleSection({title,collapsed,onToggle,children}:{title:string;collapsed:boolean;onToggle:()=>void;children:React.ReactNode}) { return <section style={styles.collapsibleSection}><button style={styles.collapsibleHeader} onClick={onToggle}><strong>{title}</strong><span>{collapsed?"+":"−"}</span></button>{!collapsed&&<div style={styles.collapsibleBody}>{children}</div>}</section>; }
function CompletionStatus({label,completedAt}:{label:string;completedAt?:string|SignOffCompletion}) { const info=completionInfo(completedAt); return <div style={styles.trackerRow}><div style={styles.completionIdentity}><span>{label}</span>{info&&<small>Completed by {info.completedBy} - {new Date(info.completedAt).toLocaleString()}</small>}</div><span style={{...styles.trackerBadge,...(info?styles.trackerComplete:styles.trackerOutstanding)}}>{info?"Complete":"Outstanding"}</span></div>; }
type ProtectionPatch = { overcurrent?:boolean; residual?:boolean; rating?:string; type?:string; residualRating?:string; delay?:string };
function ProtectionChoice({number,title,overcurrent,residual,rating,type,residualRating,delay,disabled,onPatch}:{number:string;title:string;overcurrent:boolean;residual:boolean;rating:string;type:string;residualRating:string;delay:string;disabled?:boolean;onPatch:(patch:ProtectionPatch)=>void}) {
  return <div style={styles.numberedRow}><strong>{number}. {title}</strong><div style={styles.protectionStack}><div style={styles.protectionOption}><label><input type="checkbox" disabled={disabled} checked={overcurrent} onChange={(event)=>onPatch({overcurrent:event.target.checked})}/> CB/RCBO/fuse rating</label>{overcurrent&&<div style={styles.sourceGrid}><label style={styles.field}><span>Rating (A)</span><input style={styles.input} disabled={disabled} value={rating} onChange={(event)=>onPatch({rating:event.target.value})}/></label><label style={styles.field}><span>Type</span><input style={styles.input} disabled={disabled} value={type} onChange={(event)=>onPatch({type:event.target.value})}/></label></div>}</div><div style={styles.protectionOption}><label><input type="checkbox" disabled={disabled} checked={residual} onChange={(event)=>onPatch({residual:event.target.checked})}/> RCD/RCBO IΔn mA</label>{residual&&<div style={styles.sourceGrid}><label style={styles.field}><span>IΔn (mA)</span><input style={styles.input} disabled={disabled} value={residualRating} onChange={(event)=>onPatch({residualRating:event.target.value})}/></label><label style={styles.field}><span>Time delay (ms)</span><input style={styles.input} disabled={disabled} value={delay} onChange={(event)=>onPatch({delay:event.target.value})}/></label></div>}</div></div></div>;
}

const styles: Record<string, React.CSSProperties> = {
  inlineLinkManager:{display:"grid",gap:"16px",padding:"18px",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white"},
  certificateHeader:{display:"grid",gridTemplateColumns:"120px minmax(0,1fr) 120px",alignItems:"start",gap:"18px",padding:"20px",borderBottom:"1px solid #98a2b3"},
  certificateHeaderShell:{overflow:"hidden",border:"1px solid #9ca3af",borderRadius:"3px",background:"white"},
  certificateLogo:{width:"110px",height:"80px",objectFit:"contain",objectPosition:"left top"},
  certificateLogoSpace:{display:"block",width:"110px",height:"1px"},
  certificateHeading:{display:"grid",gap:"14px",textAlign:"center"},
  certificateTitle:{margin:0,fontSize:"24px"},
  certificateSubtitle:{margin:0,fontWeight:600,lineHeight:1.45},
  certificateDescription:{margin:0,lineHeight:1.5,textAlign:"center"},
  certificateToolbar:{display:"flex",justifyContent:"flex-end",padding:"12px 16px",borderBottom:"1px solid #98a2b3"},
  g3Applicability:{padding:"12px 16px",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white"},
  distroIdentity:{display:"grid",gap:"5px",lineHeight:1.35},
  informationHeading:{display:"grid",gap:"4px"},
  part3Rows:{display:"grid"},
  part3Pair:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))"},
  part3Single:{display:"grid",gridTemplateColumns:"minmax(0,1fr)"},
  page:{display:"grid",gap:"16px"},state:{padding:"24px",background:"white",borderRadius:"14px"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"16px",flexWrap:"wrap"},title:{margin:0,fontSize:"26px"},muted:{margin:"4px 0",color:"#667085"},actions:{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"},saveStatus:{fontSize:"12px",color:"#667085"},
  subTabs:{display:"flex",flexWrap:"wrap",gap:"4px",padding:"5px",border:"1px solid #DCE5EC",borderRadius:"14px",background:"#F8FAFC"},subTab:{padding:"10px 13px",border:"1px solid transparent",borderRadius:"10px",cursor:"pointer",boxShadow:"none",outline:"none",whiteSpace:"nowrap"},activeSubTab:{borderColor:"var(--lva-workspace-highlight-border, #242424)",background:"var(--lva-workspace-highlight, #ececec)",color:"#111827"},inactiveSubTab:{borderColor:"transparent",background:"#F8FAFC",color:"#526071"},hoveredSubTab:{borderColor:"#CBD5E1",background:"#EEF2F6",color:"#111827"},
  card:{padding:"20px",border:"1px solid #dce5ec",borderRadius:"14px",background:"white"},informationPage:{display:"grid",gap:"14px",padding:"20px",border:"1px solid #dce5ec",borderRadius:"14px",background:"white"},collapsibleSection:{overflow:"hidden",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white"},collapsibleHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"12px 14px",border:0,background:"#f8fafc",color:"#101828",textAlign:"left",cursor:"pointer"},collapsibleBody:{padding:"14px",borderTop:"1px solid #e4e7ec"},detailGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:"1px",overflow:"hidden",border:"1px solid #e4e7ec",borderRadius:"8px",background:"#e4e7ec"},trackerGrid:{display:"grid",gap:"8px"},trackerRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",padding:"11px 13px",border:"1px solid #e4e7ec",borderRadius:"8px"},completionIdentity:{display:"grid",gap:"4px",lineHeight:1.35},trackerBadge:{padding:"3px 8px",borderRadius:"999px",fontSize:"11px",fontWeight:700},trackerComplete:{background:"#ecfdf3",color:"#067647"},trackerOutstanding:{background:"#fffaeb",color:"#b54708"},sectionTitle:{margin:0},compactActions:{display:"flex",gap:"7px",alignItems:"center",flexWrap:"wrap"},formGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"14px"},field:{display:"grid",alignContent:"start",gap:"6px",fontSize:"13px",color:"#526071"},input:{width:"100%",minHeight:"38px",boxSizing:"border-box",padding:"7px 9px",border:"1px solid #cbd5e1",borderRadius:"7px",background:"white"},textarea:{width:"100%",minHeight:"86px",boxSizing:"border-box",padding:"7px 9px",border:"1px solid #cbd5e1",borderRadius:"7px",resize:"vertical"},check:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px"},sectionHeader:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:"16px",flexWrap:"wrap"},distroGroup:{display:"grid",gap:"0",marginTop:"14px",overflow:"hidden",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white"},distroHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"12px 14px",border:0,background:"#f8fafc",color:"#101828",textAlign:"left",cursor:"pointer"},circuitRow:{display:"grid",gap:"9px",padding:"12px 14px",borderTop:"1px solid #e4e7ec"},circuitSummary:{display:"grid",gridTemplateColumns:"auto minmax(0,1fr)",gap:"10px",alignItems:"start"},circuitExpand:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:"12px",padding:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer"},circuitDetails:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:"1px",overflow:"hidden",border:"1px solid #e4e7ec",borderRadius:"8px",background:"#e4e7ec"},detail:{display:"grid",gap:"4px",padding:"10px",background:"#fff",fontSize:"12px"},badges:{display:"flex",gap:"5px",paddingLeft:"28px",flexWrap:"wrap"},statusBadge:{padding:"3px 7px",borderRadius:"999px",fontSize:"11px",border:"1px solid"},statusComplete:{background:"#ecfdf3",borderColor:"#abefc6",color:"#067647"},statusPartial:{background:"#fffaeb",borderColor:"#fedf89",color:"#b54708"},statusMissing:{background:"#fef3f2",borderColor:"#fecdca",color:"#b42318"},empty:{margin:"14px 0 0",padding:"16px",border:"1px dashed #cbd5e1",borderRadius:"8px",color:"#667085",background:"#f8fafc"},
  g1Selector:{display:"flex",alignItems:"end",justifyContent:"space-between",gap:"12px",padding:"14px 16px",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white",flexWrap:"wrap"},formSheet:{overflow:"hidden",border:"1px solid #9ca3af",borderRadius:"3px",background:"white"},formSheetWide:{display:"none"},formTitle:{padding:"18px",textAlign:"center"},referenceRow:{display:"grid",gridTemplateColumns:"minmax(260px,45%)",justifyContent:"end",padding:"0 12px 10px"},formPart:{borderTop:"1px solid #6b7280"},partTitle:{margin:0,padding:"7px 9px",background:"#d9d9d9",fontSize:"18px",borderBottom:"1px solid #6b7280"},partBody:{padding:"0"},twoColumns:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))"},checkGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"0",padding:"8px"},formCell:{position:"relative",display:"grid",alignContent:"start",gap:"7px",minHeight:"68px",padding:"10px",borderRight:"1px solid #9ca3af",borderBottom:"1px solid #9ca3af",boxSizing:"border-box"},formLabel:{fontWeight:700,color:"#1f2937"},formInput:{width:"100%",minHeight:"34px",padding:"5px 7px",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:"3px"},formTextarea:{width:"100%",minHeight:"72px",padding:"6px",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:"3px",resize:"vertical"},autoTag:{display:"inline-block",marginLeft:"6px",padding:"1px 5px",borderRadius:"999px",background:"#e0f2fe",color:"#0369a1",fontWeight:600,fontSize:"10px"},resetAuto:{justifySelf:"start",padding:0,border:0,background:"transparent",color:"#667085",fontSize:"11px",textDecoration:"underline",cursor:"pointer"},inlineChoices:{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"},demandRow:{display:"grid",gridTemplateColumns:"minmax(160px,1fr) 90px 34px",gap:"8px",alignItems:"end"},reloadButton:{width:"34px",height:"34px",border:"1px solid #cbd5e1",borderRadius:"6px",background:"#f8fafc",fontSize:"18px",cursor:"pointer"},fieldHelp:{color:"#667085",lineHeight:1.4},numberedRows:{display:"grid"},numberedRow:{display:"grid",gap:"10px",padding:"12px",borderBottom:"1px solid #98a2b3"},statementRow:{display:"grid",gridTemplateColumns:"auto minmax(0,1fr)",alignItems:"start",gap:"6px",padding:"12px",borderBottom:"1px solid #98a2b3",fontWeight:700},sourceGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"12px"},protectionStack:{display:"grid",gap:"12px"},protectionOption:{display:"grid",gap:"9px",padding:"10px",border:"1px solid #e4e7ec",borderRadius:"8px",background:"#f8fafc"},declaration:{margin:0,padding:"14px",lineHeight:1.5},
  g2Header:{display:"grid",gridTemplateColumns:"minmax(260px,2fr) minmax(80px,.45fr) minmax(80px,.45fr) minmax(180px,1fr)",borderTop:"1px solid #6b7280"},tableWrap:{overflowX:"auto"},g2Table:{width:"100%",minWidth:"1500px",borderCollapse:"collapse",tableLayout:"fixed",fontSize:"11px"},sectionTable:{width:"100%",minWidth:"760px",borderCollapse:"collapse",tableLayout:"fixed"},manualSection:{display:"none"},manualTable:{width:"100%",minWidth:"940px",borderCollapse:"collapse",tableLayout:"fixed",fontSize:"12px"},manualResultsTable:{width:"100%",minWidth:"1050px",borderCollapse:"collapse",tableLayout:"fixed",fontSize:"12px"},g2Sheet:{overflow:"hidden",border:"1px solid #98a2b3",borderRadius:"4px",background:"white"},g2TitleRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",padding:"18px"},g2CertificateHeader:{display:"grid",gridTemplateColumns:"minmax(260px,2fr) minmax(180px,1fr)",borderTop:"1px solid #98a2b3"},newG2Table:{width:"100%",minWidth:"1900px",borderCollapse:"collapse",tableLayout:"fixed",fontSize:"11px"},checkboxCell:{textAlign:"center",verticalAlign:"middle"},manualComments:{display:"grid",gap:"5px"},removeRowButton:{padding:0,border:0,background:"transparent",color:"#b42318",fontSize:"11px",textAlign:"left",cursor:"pointer"},overrideCell:{display:"flex",gap:"3px",alignItems:"center"},instrumentGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))"},instrumentCard:{display:"grid",gap:"8px",padding:"12px",borderRight:"1px solid #9ca3af"},
  removeElectricianCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",padding:"14px 16px",border:"1px solid #fecaca",borderRadius:"10px",background:"#fffafa",flexWrap:"wrap"},removeElectricianControls:{display:"grid",gridTemplateColumns:"minmax(220px,1fr) auto",gap:"8px",alignItems:"center"},completionControl:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",padding:"16px",border:"1px solid #d0d5dd",borderRadius:"10px",background:"white"},completedControl:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",padding:"16px",border:"1px solid #b7c3d0",borderRadius:"10px",background:"#eaecf0",color:"#475467"},completeButton:{padding:"9px 15px",border:"1px solid #067647",borderRadius:"8px",background:"#067647",color:"white",fontWeight:700,cursor:"pointer"},revokeButton:{padding:"9px 15px",border:"1px solid #98a2b3",borderRadius:"8px",background:"white",color:"#344054",fontWeight:700,cursor:"pointer"},secondaryButton:{padding:"9px 12px",border:"1px solid #cbd5e1",borderRadius:"8px",background:"white",cursor:"pointer"},primaryButton:{padding:"9px 12px",border:"1px solid var(--lva-workspace-dark-button,#172033)",borderRadius:"8px",background:"var(--lva-workspace-dark-button,#172033)",color:"white",cursor:"pointer"},dangerButton:{padding:"9px 12px",border:"1px solid #fecaca",borderRadius:"8px",background:"#fff1f1",color:"#b42318",cursor:"pointer"},textButton:{padding:"5px 8px",border:0,background:"transparent",textDecoration:"underline",cursor:"pointer"},iconButton:{padding:"5px 7px",border:"1px solid #d0d5dd",borderRadius:"6px",background:"white",cursor:"pointer"},error:{display:"flex",justifyContent:"space-between",padding:"10px 12px",border:"1px solid #fecaca",borderRadius:"9px",background:"#fff1f1",color:"#b42318"},closeError:{border:0,background:"transparent",cursor:"pointer"},modalBackdrop:{position:"fixed",inset:0,zIndex:1000,display:"grid",placeItems:"center",padding:"20px",background:"rgba(15,23,42,.55)"},modal:{width:"min(560px,100%)",display:"grid",gap:"12px",padding:"20px",borderRadius:"14px",background:"white",boxShadow:"0 20px 55px rgba(0,0,0,.25)"},linkModal:{width:"min(860px,100%)",maxHeight:"90vh",overflowY:"auto",display:"grid",gap:"16px",padding:"20px",borderRadius:"14px",background:"white",boxShadow:"0 20px 55px rgba(0,0,0,.25)"},linkForm:{display:"grid",gridTemplateColumns:"repeat(3,minmax(170px,1fr)) auto",gap:"10px",alignItems:"end"},generatedLink:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:"8px"},linkMessage:{margin:0,padding:"9px 11px",borderRadius:"8px",background:"#f2f4f7",color:"#475467"},linkList:{display:"grid",gap:"8px"},linkCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",padding:"12px 14px",border:"1px solid #e4e7ec",borderRadius:"9px"},electricianToolbar:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"12px"},manualElectricianForm:{display:"grid",gridTemplateColumns:"repeat(3,minmax(150px,1fr)) auto",gap:"9px",alignItems:"center",marginBottom:"12px"},electricianList:{display:"grid",gap:"8px"},electricianCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",padding:"12px 14px",border:"1px solid #e4e7ec",borderRadius:"8px"},linkIdentity:{display:"grid",gap:"4px",lineHeight:1.35},rowActions:{display:"flex",alignItems:"center",gap:"8px"},manualBadge:{background:"#f2f4f7",color:"#475467"},modalActions:{display:"flex",justifyContent:"flex-end",gap:"8px",flexWrap:"wrap"},linkInput:{width:"100%",boxSizing:"border-box",padding:"9px",border:"1px solid #cbd5e1",borderRadius:"8px"}
};

styles.formTitle={...styles.formTitle,display:"none"};
styles.g2TitleRow={...styles.g2TitleRow,display:"none"};
