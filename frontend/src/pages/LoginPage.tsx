import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const SAVED_CREDENTIALS_KEY = 'saved_credentials'

function getSavedCredentials(): {
  email: string
  password: string
  remember: boolean
} | null {
  try {
    const saved = localStorage.getItem(SAVED_CREDENTIALS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    /* ignore */
  }
  return null
}

const loginSchema = z.object({
  email: z.string().email('\uC720\uD6A8\uD55C \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'),
  password: z.string().min(1, '\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [serverError, setServerError] = useState<string | null>(null)
  const saved = getSavedCredentials()
  const [remember, setRemember] = useState(saved?.remember ?? false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: saved?.email ?? '',
      password: saved?.password ?? '',
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await login(values.email, values.password)
      if (remember) {
        localStorage.setItem(
          SAVED_CREDENTIALS_KEY,
          JSON.stringify({
            email: values.email,
            password: values.password,
            remember: true,
          }),
        )
      } else {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY)
      }
      navigate('/')
    } catch {
      setServerError(
        '\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
      )
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>
            Vision Flow에 오신 것을 환영합니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                로그인 정보 저장
              </label>
              {serverError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          계정이 없으신가요?&nbsp;
          <Link
            to="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            회원가입
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
