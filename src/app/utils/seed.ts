import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedTesterTechnician = async () => {
  try {
    const isTesterTechnicianExist = await prisma.user.findUnique({
      where: {
        email: config.tester_tecnician_email,
      },
    });

    if (isTesterTechnicianExist) {
      console.log("Tester Technician Already Exists!");
      return;
    }

    const name = config.tester_tecnician_name;
    const email = config.tester_tecnician_email;
    const password = config.tester_tecnician_password;

    if (!name || !email || !password) {
      throw new Error(
        "Tester Technician Name , Email, Password Missing In Env File!!!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerTechnician = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.TECHNICIAN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    await prisma.technician.create({
      data: {
        userId: testerTechnician.id,
        name: testerTechnician.name,
        email: testerTechnician.email,
      },
    });

    console.log("Tester Technician Created : ", testerTechnician);
  } catch (error) {
    console.log("Error Seeding Tester Technician : ", error);

    if (config.tester_tecnician_email) {
      await prisma.user.deleteMany({
        where: { email: config.tester_tecnician_email },
      });
    }
  }
};

export const seedTesterAdmin = async () => {
  try {
    const isTesterAdminrExist = await prisma.user.findUnique({
      where: {
        email: config.tester_admin_email,
      },
    });

    if (isTesterAdminrExist) {
      console.log("Tester Admin Already Exists!");
      return;
    }

    const name = config.tester_admin_name;
    const email = config.tester_admin_email;
    const password = config.tester_admin_password;

    if (!name || !email || !password) {
      throw new Error(
        "Tester Admin Name , Email, Password Missing In Env File!!!",
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const testerAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.ADMIN,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    await prisma.admin.create({
      data: {
        userId: testerAdmin.id,
        department: "Operations",
        name: testerAdmin.name,
        email: testerAdmin.email,
      },
    });

    console.log("Tester Admin Created : ", testerAdmin);
  } catch (error) {
    console.log("Error Seeding Tester Admin : ", error);

    if (config.tester_admin_email) {
      await prisma.user.deleteMany({
        where: { email: config.tester_admin_email },
      });
    }
  }
};
