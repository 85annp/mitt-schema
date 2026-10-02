"use server";

import fetchSkolor from "@/utils/scheduleFetching/fetchSkolor";
import fetchKlassLista from "@/utils/scheduleFetching/fetchKlassLista";
import { kommunToSkola24 } from "@/utils/sanitize/kommunToSkola24";
import getKey from "@/utils/scheduleFetching/getKey";
import getSchoolYear from "@/utils/scheduleFetching/getSchoolYear";
import getSignature from "@/utils/scheduleFetching/getSignature";
import getTimetable from "@/utils/scheduleFetching/getTimetable";
import getCurrentWeekNumber from "@/utils/getCurrentWeekNumber";

export async function getSchools(kommun: string) {
  try {
    const hostName = `${kommunToSkola24(kommun)}.skola24.se`;
    const schools = await fetchSkolor(hostName);
    return { success: true, schools };
  } catch (error) {
    return { success: false, error: "Kunde inte hamta skolor." };
  }
}

export async function getClasses(kommun: string, unitGuid: string) {
  try {
    const classes = await fetchKlassLista(kommun, unitGuid);
    return { success: true, classes };
  } catch (error) {
    return { success: false, error: "Kunde inte hamta klasser." };
  }
}

import getNextMondayIfWeekend from "@/utils/getNextMondayIfWeekend";

export async function getWeeklySchedule(kommun: string, unitGuid: string, schemaId: string, year?: number, week?: number) {
  try {
    const hostName = `${kommunToSkola24(kommun)}.skola24.se`;
    const schoolYear = await getSchoolYear(hostName);
    const signature = await getSignature(schemaId);
    const key = await getKey();
    
    // Auto-advance to next week if it's the weekend
    const defaultDate = getNextMondayIfWeekend(new Date());
    const targetYear = year || defaultDate.getFullYear();
    const targetWeek = week || getCurrentWeekNumber(defaultDate);

    const timetable = await getTimetable(
      schoolYear,
      kommun,
      signature,
      key,
      targetYear,
      targetWeek,
      0, // 0 for full week
      unitGuid
    );
    
    return { 
      success: true, 
      timetable: timetable?.data?.lessonInfo || [],
      week: targetWeek,
      year: targetYear 
    };
  } catch (error) {
    return { success: false, error: "Kunde inte hamta schemat." };
  }
}
