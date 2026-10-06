// import bcrypt from "bcryptjs";
// import { Role } from "../../generated/prisma/enums";
// import config from "../config";
// import { prisma } from "../lib/prisma";

// export const seedTesterTechnician = async () => {
//   try {
//     const isTesterTechnicianExist = await prisma.user.findUnique({
//       where: {
//         email: config.tester_tecnician_email,
//       },
//     });

//     if (isTesterTechnicianExist) {
//       console.log("Tester Technician Already Exists!");
//       return;
//     }

//     const name = config.tester_tecnician_name;
//     const email = config.tester_tecnician_email;
//     const password = config.tester_tecnician_password;

//     if (!name || !email || !password) {
//       throw new Error(
//         "Tester Technician Name , Email, Password Missing In Env File!!!",
//       );
//     }

//     const hashedPassword = await bcrypt.hash(
//       password,
//       Number(config.bcrypt_salt_rounds),
//     );

//     const testerTechnician = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: Role.TECHNICIAN,
//         needPasswordChange: false,
//         emailVerified: true,
//       },
//     });

//     await prisma.technician.create({
//       data: {
//         userId: testerTechnician.id,
//         name: testerTechnician.name,
//         email: testerTechnician.email,
//       },
//     });

//     console.log("Tester Technician Created : ", testerTechnician);
//   } catch (error) {
//     console.log("Error Seeding Tester Technician : ", error);

//     if (config.tester_tecnician_email) {
//       await prisma.user.deleteMany({
//         where: { email: config.tester_tecnician_email },
//       });
//     }
//   }
// };

// export const seedTesterAdmin = async () => {
//   try {
//     const isTesterAdminrExist = await prisma.user.findUnique({
//       where: {
//         email: config.tester_admin_email,
//       },
//     });

//     if (isTesterAdminrExist) {
//       console.log("Tester Admin Already Exists!");
//       return;
//     }

//     const name = config.tester_admin_name;
//     const email = config.tester_admin_email;
//     const password = config.tester_admin_password;

//     if (!name || !email || !password) {
//       throw new Error(
//         "Tester Admin Name , Email, Password Missing In Env File!!!",
//       );
//     }

//     const hashedPassword = await bcrypt.hash(
//       password,
//       Number(config.bcrypt_salt_rounds),
//     );

//     const testerAdmin = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: Role.ADMIN,
//         needPasswordChange: false,
//         emailVerified: true,
//       },
//     });

//     await prisma.admin.create({
//       data: {
//         userId: testerAdmin.id,
//         department: "Operations",
//         name: testerAdmin.name,
//         email: testerAdmin.email,
//       },
//     });

//     console.log("Tester Admin Created : ", testerAdmin);
//   } catch (error) {
//     console.log("Error Seeding Tester Admin : ", error);

//     if (config.tester_admin_email) {
//       await prisma.user.deleteMany({
//         where: { email: config.tester_admin_email },
//       });
//     }
//   }
// };

import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

const hashPassword = (password: string) =>
  bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

/**
 * Creates THE single admin of the system.
 *
 * Rules:
 * - Runs on every start but is safe to repeat (does nothing if an admin exists).
 * - Never deletes anything. User + admin profile are created in ONE transaction,
 *   so a failure leaves nothing half-created.
 * - The database also enforces "only one admin" (unique indexes
 *   only_one_admin_user / only_one_admin_profile), even if two servers start together.
 */
export const seedAdmin = async () => {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true },
    });

    if (existingAdmin) {
      console.log("Admin already exists. Skipping admin seed.");
      return;
    }

    const name = config.admin_name;
    const email = config.admin_email;
    const password = config.admin_password;

    if (!name || !email || !password) {
      throw new Error(
        "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in the env file",
      );
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    if (emailOwner) {
      throw new Error(
        `Cannot seed admin: "${email}" already belongs to a ${emailOwner.role} account. Use a different ADMIN_EMAIL.`,
      );
    }

    const hashedPassword = await hashPassword(password);

    const admin = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.ADMIN,
          needPasswordChange: false,
          emailVerified: true,
        },
      });

      await tx.admin.create({
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          department: "Operations",
        },
      });

      return user;
    });

    // never log the whole user object (it contains the password hash)
    console.log(`Admin created: ${admin.email}`);
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
};

/**
 * Development-only technician for quick testing.
 * Never runs when NODE_ENV=production.
 */
export const seedTechnician = async () => {
  if (config.node_env === "production") return;

  try {
    const name = config.technician_name;
    const email = config.technician_email;
    const password = config.technician_password;

    if (!name || !email || !password) {
      console.log("Dev technician env not set. Skipping dev technician seed.");
      return;
    }

    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (exists) {
      console.log("Dev Technician already exists.");
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.TECHNICIAN,
          needPasswordChange: false,
          emailVerified: true,
        },
      });

      await tx.technician.create({
        data: {
          userId: created.id,
          name: created.name,
          email: created.email,
        },
      });

      return created;
    });

    console.log(`Dev Technician created: ${user.email}`);
  } catch (error) {
    console.error("Error seeding dev technician:", error);
  }
};
