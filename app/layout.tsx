import type {Metadata} from 'next'; import './globals.css';
export const metadata:Metadata={title:'CivicOS — Evidence before decisions',description:'Trace claims to evidence. Record human review. Verify decision records on Solana.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}